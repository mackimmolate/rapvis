
import pandas as pd
from tkinter import messagebox, filedialog
from model import DemandModel
from view import DemandView
from config_manager import ConfigManager
import tkinter as tk

class DemandController:
    def __init__(self, root):
        self.config_manager = ConfigManager()
        self.model = DemandModel(self.config_manager)
        self.view = DemandView(self, self.config_manager)
        self.root = self.view # The view is the window

    def start(self):
        self.view.mainloop()

    def load_file1(self):
        path = self.view.ask_file()
        if path:
            self.view.show_loading(True)
            self.model.load_data_async(path, False, self.on_load_success, self.on_load_error)

    def load_history(self):
        path = self.view.ask_file()
        if path:
            self.view.show_loading(True)
            self.model.load_data_async(path, True, self.on_load_success, self.on_load_error)

    def on_load_success(self, is_history):
        # This runs in background thread, so we must schedule UI update
        self.view.after(0, self._post_load_update, is_history)

    def on_load_error(self, error_msg):
        self.view.after(0, lambda: self._show_error(error_msg))

    def _show_error(self, msg):
        self.view.show_loading(False)
        messagebox.showerror("Fel", msg)

    def _post_load_update(self, is_history):
        self.view.show_loading(False)
        if is_history:
             self.view.clear_history_btn.configure(state="normal")

        self.update_ui()

    def update_ui(self, preserve_selection=False):
        # Read from view to sync model state FIRST
        self.model.set_time_scale(self.view.time_scale_var.get())

        # Update dropdowns based on loaded data (using new scale)
        periods = self.model.get_period_list()
        self.view.update_dropdowns(periods)

        # Apply filters
        self.model.set_filter_range(self.view.from_var.get(), self.view.to_var.get())

        if not preserve_selection:
            self.model.set_article_filter(self.view.article_var.get())

        # Get data
        data1, hist, agg1, agg_hist = self.model.get_filtered_data()

        # Update Graph
        self.view.update_graph(agg1, agg_hist)

        # Prepare Table Data
        merged_table = self._prepare_table_data(data1, hist)
        self.view.update_table(merged_table)
        self.current_table_data = merged_table # Keep for export

        # Generate Insights
        self._generate_insights(agg1, merged_table)

    def _prepare_table_data(self, df1, df2):
        curr = pd.Series(dtype='float64')
        if not df1.empty:
            curr = df1.groupby(self.model.article_col)["Demand"].sum()

        hist = pd.Series(dtype='float64')
        if not df2.empty:
            hist = df2.groupby(self.model.article_col)["Demand"].sum()

        merged = pd.concat([curr.rename("Current"), hist.rename("History")], axis=1).fillna(0)
        merged["Diff"] = merged["Current"] - merged["History"]
        merged = merged.reset_index().rename(columns={"index": "Article"})

        # Sorting
        if self.view.sort_column:
            col = self.view.sort_column
            asc = not self.view.sort_descending
            if col == "Article":
                 merged = merged.sort_values(by=col, ascending=asc, key=lambda x: x.astype(str).str.lower())
            else:
                 merged = merged.sort_values(by=col, ascending=asc)

        return merged

    def _generate_insights(self, agg_data, table_data):
        if agg_data.empty:
            self.view.update_insights("Ingen data tillgänglig.")
            return

        total_demand = agg_data["Demand"].sum()
        peak_row = agg_data.loc[agg_data["Demand"].idxmax()]
        scale = self.model.time_scale
        if scale == "weeks":
            peak_period = peak_row["Week Start"].strftime("%G-W%V")
        elif scale == "months":
            peak_period = peak_row["Week Start"].strftime("%Y-%m")
        else:
            peak_period = peak_row["Week Start"].strftime("%Y")
        peak_val = peak_row["Demand"]

        total_str = f"{total_demand:,.0f}".replace(",", " ")
        peak_str = f"{peak_val:,.0f}".replace(",", " ")
        text = f"Totalt behov: {total_str} | Topp: {peak_period} ({peak_str})"
        self.view.update_insights(text)

    def on_timescale_change(self):
        self.update_ui(preserve_selection=True)

    def on_filter_change(self, event=None):
        self.update_ui()

    def on_annotation_toggle(self):
        self.update_ui() # Redraw graph

    def reset_filters(self):
        self.view.article_var.set("Alla")
        self.view.from_var.set("")
        self.view.to_var.set("")
        self.model.set_selected_articles([]) # Explicitly clear selection
        self.update_ui()

    def clear_history(self):
        self.model.clear_history()
        self.view.clear_history_btn.configure(state="disabled")
        self.update_ui()

    def sort_table(self, col):
        if self.view.sort_column == col:
            self.view.sort_descending = not self.view.sort_descending
        else:
            self.view.sort_column = col
            self.view.sort_descending = False

        # Refresh table only
        data1, hist, _, _ = self.model.get_filtered_data()
        table_df = self._prepare_table_data(data1, hist)
        self.view.update_table(table_df)

    def filter_selection(self):
        # Get selected from view
        selected_items = self.view.tree.selection()
        if selected_items:
            articles = [self.view.tree.item(item, "values")[0] for item in selected_items]
            self.model.set_selected_articles(articles)
            self.update_ui(preserve_selection=True)

    def on_graph_click(self, data1, data2):
        # When graph clicked, we get specific week data
        # Update table to show only this week's breakdown
        table_df = self._prepare_table_data(data1, data2)
        self.view.update_table(table_df)

if __name__ == "__main__":
    app = DemandController(None)
    app.start()
