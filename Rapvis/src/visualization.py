# visualization.py

import tkinter as tk
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.dates import MO
import pandas as pd
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import datetime
import numpy as np
from datetime import timedelta


def period_str_to_datetime(s, scale):
    """Konverterar periodsträngar till pd.Timestamp baserat på vald skala."""
    if not s:
        return None
    try:
        if scale in ("weeks", "Veckor"):
            year, week_str = s.split("-W")
            year, week = int(year), int(week_str)
            # Använder fromisocalendar som förväntar sig standard ISO-vecka
            return pd.Timestamp(datetime.date.fromisocalendar(year, week, 1))
        if scale in ("months", "Månader"):
            return pd.to_datetime(s, format="%Y-%m")
        if scale in ("years", "År"):
            return pd.to_datetime(s, format="%Y")
    except (ValueError, TypeError):
        return pd.to_datetime(s, errors="coerce")
    return pd.to_datetime(s, errors="coerce")


def convert_range_to_scale(start_dt, end_dt, scale):
    """Returnerar periodsträngar för den valda skalan som täcker datumintervallet."""
    if not start_dt or not end_dt:
        return "", ""

    if scale in ("weeks", "Veckor"):
        start_cal = start_dt.isocalendar()
        end_cal = end_dt.isocalendar()
        start_str = f"{start_cal.year}-W{start_cal.week:02d}"
        end_str = f"{end_cal.year}-W{end_cal.week:02d}"
    elif scale in ("months", "Månader"):
        start_str = start_dt.strftime("%Y-%m")
        end_str = end_dt.strftime("%Y-%m")
    else:  # År
        start_str = start_dt.strftime("%Y")
        end_str = end_dt.strftime("%Y")
    return start_str, end_str


def on_click(event, data1, data2, update_function, time_scale="weeks"):
    """Hanterar klickhändelser på grafen för att visa detaljerad data för den klickade perioden."""
    if event.inaxes is None or event.xdata is None:
        return

    clicked_date = mdates.num2date(event.xdata).date()

    # Determine the period start date based on the time scale
    target_date = None
    if time_scale == "weeks":
        # Snap to Monday of the clicked week
        target_date = clicked_date - timedelta(days=clicked_date.weekday())
    elif time_scale == "months":
        # Snap to 1st of the month
        target_date = clicked_date.replace(day=1)
    elif time_scale == "years":
        # Snap to Jan 1st
        target_date = clicked_date.replace(month=1, day=1)

    if not target_date:
        return

    # Filter data for the EXACT target date
    selected_data1 = pd.DataFrame()
    if data1 is not None and not data1.empty:
        selected_data1 = data1[data1["Week Start"].dt.date == target_date]

    selected_data2 = pd.DataFrame()
    if data2 is not None and not data2.empty:
        selected_data2 = data2[data2["Week Start"].dt.date == target_date]

    # If no data found for this period, update_function gets empty dfs (which results in 0s)
    update_function(selected_data1, selected_data2)


def plot_demand(
    data1,
    graph_frame,
    update_function,
    time_scale="weeks",
    data2=None,
    show_annotations=True,
):
    """Plottar efterfrågan över tid och fyller i saknade perioder med noll."""
    for widget in graph_frame.winfo_children():
        widget.destroy()

    fig, ax = plt.subplots(figsize=(10, 6), constrained_layout=True)

    plot_data1 = (
        data1.groupby("Week Start")["Demand"].sum().reset_index()
        if data1 is not None and not data1.empty
        else pd.DataFrame()
    )
    plot_data2 = (
        data2.groupby("Week Start")["Demand"].sum().reset_index()
        if data2 is not None and not data2.empty
        else pd.DataFrame()
    )

    def _fill_missing_dates(df, full_range):
        if df.empty:
            return pd.DataFrame(
                {"Week Start": full_range, "Demand": [0] * len(full_range)}
            )

        df = df.set_index(pd.to_datetime(df["Week Start"]))
        df = df[["Demand"]].reindex(full_range, fill_value=0)
        df = df.reset_index()
        return df.rename(columns={"index": "Week Start"})

    all_plot_data = pd.concat([plot_data1, plot_data2])
    if not all_plot_data.empty:
        min_date = all_plot_data["Week Start"].min()
        max_date = all_plot_data["Week Start"].max()

        if time_scale == "weeks":
            freq = "W-MON"
        elif time_scale == "months":
            freq = "MS"
        else:
            freq = "YS"

        full_range = pd.date_range(start=min_date, end=max_date, freq=freq)

        plot_data1 = _fill_missing_dates(plot_data1, full_range)
        plot_data2 = _fill_missing_dates(plot_data2, full_range)

    data_is_plotted = False

    def _plot_line(plot_data, label, color, linestyle):
        nonlocal data_is_plotted
        if not plot_data.empty and plot_data["Demand"].sum() > 0:
            plot_data = plot_data.sort_values(by="Week Start")
            ax.plot(
                plot_data["Week Start"],
                plot_data["Demand"],
                marker="o",
                markersize=4,
                color=color,
                linestyle=linestyle,
                label=label,
            )
            data_is_plotted = True

    _plot_line(plot_data1, "Nuvarande", "#5b9bd5", "-")
    _plot_line(plot_data2, "Historik", "#70ad47", "--")

    if show_annotations:
        # Annotate plot_data1
        for i, row in plot_data1.iterrows():
            if row["Demand"] > 0:  # Only annotate if there's actual demand
                ax.annotate(
                    f'{row["Demand"]:.0f}',
                    (row["Week Start"], row["Demand"]),
                    textcoords="offset points",
                    xytext=(0, 5),  # Offset text slightly above the point
                    ha="center",
                    fontsize=9,
                    color="black",  # Changed text color to black
                    bbox=dict(
                        boxstyle="round,pad=0.3",
                        fc="wheat",
                        ec="gray",
                        lw=0.5,
                        alpha=0.7,
                    ),
                )  # Added bbox

        # Annotate plot_data2
        for i, row in plot_data2.iterrows():
            if row["Demand"] > 0:  # Only annotate if there's actual demand
                ax.annotate(
                    f'{row["Demand"]:.0f}',
                    (row["Week Start"], row["Demand"]),
                    textcoords="offset points",
                    xytext=(
                        0,
                        -10,
                    ),  # Offset text slightly below the point for history
                    ha="center",
                    fontsize=9,
                    color="black",  # Changed text color to black
                    bbox=dict(
                        boxstyle="round,pad=0.3",
                        fc="wheat",
                        ec="gray",
                        lw=0.5,
                        alpha=0.7,
                    ),
                )  # Added bbox

    ax.set_title("Total efterfrågan över tid", fontsize=14)
    ax.set_xlabel("Datum", fontsize=12)
    ax.set_ylabel("Efterfrågan", fontsize=12)

    if data_is_plotted:
        if time_scale == "weeks":

            def week_formatter(x, pos):
                dt = mdates.num2date(x)
                # Använder strftime för robust och korrekt ISO-veckoformatering (%G-%V)
                return dt.strftime("%G-W%V")

            ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=MO, interval=1))
            ax.xaxis.set_major_formatter(plt.FuncFormatter(week_formatter))
            ax.grid(axis="x", which="major", linestyle="--", alpha=0.3)
        elif time_scale == "months":
            ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
            ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
            ax.grid(True, axis="x", linestyle="--", alpha=0.7)
        elif time_scale == "years":
            ax.xaxis.set_major_locator(mdates.YearLocator())
            ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
            ax.grid(True, axis="x", linestyle="--", alpha=0.7)

        ax.legend()
        ax.margins(x=0.02)
        fig.autofmt_xdate(rotation=30, ha="right")

        fig.canvas.mpl_connect(
            "button_press_event",
            lambda event: on_click(event, data1, data2, update_function, time_scale),
        )
    else:
        ax.text(
            0.5,
            0.5,
            "Ingen data tillgänglig för valda filter",
            horizontalalignment="center",
            verticalalignment="center",
            transform=ax.transAxes,
            fontsize=14,
            color="gray",
        )
        ax.set_xticks([])
        ax.set_yticks([])

    canvas = FigureCanvasTkAgg(fig, master=graph_frame)
    canvas.draw()
    canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    return fig
