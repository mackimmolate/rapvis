
import pandas as pd
import threading
from data_processing import load_data, aggregate_data, add_period_string, normalize_articles, get_period_strings

class DemandModel:
    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.file1_data = pd.DataFrame()
        self.history_data = pd.DataFrame()
        self.article_col = "Article number buyer"

        # Caches
        self.period_strings_cache = {} # scale -> list of strings
        self.data_with_periods_cache = {} # scale -> dataframe with PeriodString

        # State
        self.selected_articles = []
        self.time_scale = self.config_manager.get_setting("time_scale", "weeks")
        self.filter_from = ""
        self.filter_to = ""
        self.article_filter = "Alla"

    def load_data_async(self, filepath, is_history, callback_success, callback_error):
        """Loads data in a separate thread."""
        def task():
            try:
                data, article_col = load_data(filepath, return_article_col=True)

                # Pre-calculate normalized articles
                # (load_data already does this but let's ensure it's robust)

                if is_history:
                    self.history_data = data
                else:
                    self.file1_data = data
                    self.article_col = article_col

                # Invalidate caches
                self.period_strings_cache = {}
                self.data_with_periods_cache = {}

                # Pre-warm cache for current scale (optional but good for UX)
                self._ensure_period_data(self.time_scale)

                callback_success(is_history)
            except Exception as e:
                callback_error(str(e))

        threading.Thread(target=task, daemon=True).start()

    def _ensure_period_data(self, scale):
        """Ensures that data with PeriodString is cached for the given scale."""
        if scale not in self.data_with_periods_cache:
            # Process file1
            if not self.file1_data.empty:
                df1 = add_period_string(self.file1_data.copy(), scale)
            else:
                df1 = pd.DataFrame()

            # Process history
            if not self.history_data.empty:
                df2 = add_period_string(self.history_data.copy(), scale)
            else:
                df2 = pd.DataFrame()

            self.data_with_periods_cache[scale] = (df1, df2)

            # Update period strings list
            # Combine both to get full range
            combined = pd.concat([df1, df2]) if not df2.empty else df1
            if not combined.empty and "PeriodString" in combined.columns:
                 self.period_strings_cache[scale] = sorted(combined["PeriodString"].dropna().unique().tolist())
            else:
                 self.period_strings_cache[scale] = []

    def get_period_list(self):
        self._ensure_period_data(self.time_scale)
        return self.period_strings_cache.get(self.time_scale, [])

    def get_filtered_data(self):
        """Returns filtered aggregated data for plotting and table."""
        if self.file1_data.empty:
            return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

        self._ensure_period_data(self.time_scale)
        df1, df2 = self.data_with_periods_cache[self.time_scale]

        mask1 = self._build_mask(df1)
        mask2 = self._build_mask(df2) if not df2.empty else None

        filtered_data1 = df1[mask1]
        filtered_history = df2[mask2] if mask2 is not None else pd.DataFrame()

        agg_data1 = aggregate_data(filtered_data1, time_scale=self.time_scale)
        agg_hist = aggregate_data(filtered_history, time_scale=self.time_scale)

        return filtered_data1, filtered_history, agg_data1, agg_hist

    def _build_mask(self, df):
        if df.empty:
            return pd.Series(dtype=bool)

        mask = pd.Series(True, index=df.index)

        if self.filter_from and self.filter_to:
             mask &= (df["PeriodString"] >= self.filter_from) & (df["PeriodString"] <= self.filter_to)

        if self.selected_articles:
            # Use pre-normalized column from load_data
            # We assume selected_articles are raw IDs, so we normalize them to match
            selected_norm = set(normalize_articles(pd.Series(self.selected_articles)))
            mask &= df["ArticleNormalized"].isin(selected_norm)
        else:
            groups = self.config_manager.get_article_groups()
            if self.article_filter in groups:
                # Use set for faster lookup
                group_norm = set(groups[self.article_filter])
                mask &= df["ArticleNormalized"].isin(group_norm)
            elif self.article_filter == "Övrigt":
                # Create a set of all defined groups
                all_groups = set()
                for grp in groups.values():
                    all_groups.update(grp)
                mask &= ~df["ArticleNormalized"].isin(all_groups)

        return mask

    def set_time_scale(self, scale):
        self.time_scale = scale
        self.config_manager.set_setting("time_scale", scale)

    def set_filter_range(self, start, end):
        self.filter_from = start
        self.filter_to = end

    def set_article_filter(self, selection):
        if self.article_filter != selection:
            self.article_filter = selection
            self.selected_articles = [] # Reset manual selection ONLY when filter changes

    def set_selected_articles(self, articles):
        self.selected_articles = articles

    def clear_history(self):
        self.history_data = pd.DataFrame()
        self.data_with_periods_cache = {} # Clear cache as history part is gone
