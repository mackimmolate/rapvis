# data_processing.py

import pandas as pd
import datetime


def load_data(file_path, *, return_article_col=False):
    """
    Laddar och bearbetar data från en CSV-fil.
    """
    data = pd.read_csv(file_path)

    article_col = (
        "Article number buyer"
        if "Article number buyer" in data.columns
        else "Artikelnummer"
    )

    data = data.rename(columns={article_col: "Article number buyer"})
    data["ArticleNormalized"] = normalize_articles(data["Article number buyer"])

    required_columns = ["Article number buyer"]
    for col in required_columns:
        if col not in data.columns:
            raise ValueError(f"CSV-filen saknar den förväntade kolumnen: '{col}'.")

    id_columns = ["Article number buyer", "ArticleNormalized"]
    optional_columns = ["Immediate demand", "Backorder"]
    id_columns.extend([col for col in optional_columns if col in data.columns])

    week_columns = [col for col in data.columns if " - " in col]

    if not week_columns:
        raise ValueError(
            "CSV-filen saknar veckokolumner i det förväntade formatet 'YYYY-MM-DD - YYYY-MM-DD'."
        )

    long_data = pd.melt(
        data,
        id_vars=id_columns,
        value_vars=week_columns,
        var_name="Week",
        value_name="Demand",
    )

    long_data["Week Start"] = pd.to_datetime(
        long_data["Week"].apply(lambda x: x.split(" - ")[0]), errors="coerce"
    )
    long_data.dropna(subset=["Week Start"], inplace=True)

    long_data = long_data[(long_data["Demand"] > 0) & (~long_data["Demand"].isna())]
    long_data = long_data.sort_values(["Article number buyer", "Week Start"])

    if return_article_col:
        return long_data, "Article number buyer"
    return long_data


def aggregate_data(data, time_scale="weeks"):
    """Aggregerar data baserat på vald tidsenhet."""
    if "Week Start" not in data.columns or data.empty:
        return pd.DataFrame()

    if time_scale == "months":
        grouped = (
            data.groupby([data["Week Start"].dt.to_period("M"), "Article number buyer"])[
                "Demand"
            ]
            .sum()
            .reset_index()
        )
        grouped["Week Start"] = grouped["Week Start"].dt.to_timestamp()
    elif time_scale == "years":
        grouped = (
            data.groupby([data["Week Start"].dt.to_period("Y"), "Article number buyer"])[
                "Demand"
            ]
            .sum()
            .reset_index()
        )
        grouped["Week Start"] = grouped["Week Start"].dt.to_timestamp()
    else:  # Veckor som standard
        grouped = (
            data.groupby(["Week Start", "Article number buyer"])["Demand"]
            .sum()
            .reset_index()
        )

    return grouped


def normalize_articles(series):
    """Returnerar artikelnummer rensade från whitespace, versaliserade och trunkerade."""
    return (
        series.astype(str)
        .str.replace(r"[\s\u00A0]+", "", regex=True)
        .str.upper()
        .str.replace(r"[^A-Z0-9]", "", regex=True)
        .str.slice(0, 10)
    )


def add_period_string(df: pd.DataFrame, scale: str) -> pd.DataFrame:
    """Returnerar DataFrame med en PeriodString-kolumn baserat på tidsskalan."""
    if "Week Start" not in df.columns or df.empty:
        df["PeriodString"] = None
        return df

    df = df.copy()
    if scale == "months":
        df["PeriodString"] = df["Week Start"].dt.strftime("%Y-%m")
    elif scale == "years":
        df["PeriodString"] = df["Week Start"].dt.strftime("%Y")
    else:  # Veckor
        # Använder Pythons inbyggda, korrekta isocalendar()
        cal = df["Week Start"].dt.isocalendar()
        df["PeriodString"] = (
            cal["year"].astype(str) + "-W" + cal["week"].astype(str).str.zfill(2)
        )
    return df
