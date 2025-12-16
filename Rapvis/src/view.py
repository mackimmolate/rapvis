
import tkinter as tk
from tkinter import ttk, filedialog, Menu, messagebox
import ttkbootstrap as tb
from ttkbootstrap.constants import *
from tkinter import LEFT, RIGHT, TOP, BOTTOM, X, Y, BOTH, VERTICAL, HORIZONTAL
from visualization import plot_demand
import pandas as pd

class DemandView(tb.Window):
    def __init__(self, controller, config_manager):
        super().__init__(themename=config_manager.get_setting("theme", "litera"))
        self.controller = controller
        self.config_manager = config_manager

        self.title("Efterfrågeanalys V0.3")
        self.geometry(config_manager.get_setting("window_geometry", "1200x800"))
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

        # Variables
        self.time_scale_var = tk.StringVar(value=config_manager.get_setting("time_scale", "weeks"))
        self.article_var = tk.StringVar(value="Alla")
        self.from_var = tk.StringVar()
        self.to_var = tk.StringVar()
        self.show_annotations_var = tk.BooleanVar(value=config_manager.get_setting("show_annotations", True))

        # Table sort state
        self.sort_column = None
        self.sort_descending = False

        self._create_ui()

    def _create_ui(self):
        # Control Panel
        control_frame = tb.Frame(self, padding=10)
        control_frame.pack(fill=X)

        tb.Button(control_frame, text="Ladda förfrågan", command=self.controller.load_file1, bootstyle="primary").pack(side=LEFT, padx=5)
        self.load_history_btn = tb.Button(control_frame, text="Ladda historik", command=self.controller.load_history, bootstyle="secondary")
        self.load_history_btn.pack(side=LEFT, padx=(0, 5))

        # Dynamic article values from config
        article_groups = list(self.config_manager.get_article_groups().keys()) + ["Övrigt", "Alla"]
        self.article_combo = tb.Combobox(control_frame, textvariable=self.article_var, state="readonly", values=article_groups)
        self.article_combo.pack(side=LEFT, padx=5)
        self.article_combo.bind("<<ComboboxSelected>>", self.controller.on_filter_change)

        tb.Label(control_frame, text="Från:").pack(side=LEFT, padx=(10, 2))
        self.from_combo = tb.Combobox(control_frame, textvariable=self.from_var, state="readonly", width=12)
        self.from_combo.pack(side=LEFT, padx=2)
        self.from_combo.bind("<<ComboboxSelected>>", self.controller.on_filter_change)

        tb.Label(control_frame, text="Till:").pack(side=LEFT, padx=2)
        self.to_combo = tb.Combobox(control_frame, textvariable=self.to_var, state="readonly", width=12)
        self.to_combo.pack(side=LEFT, padx=2)
        self.to_combo.bind("<<ComboboxSelected>>", self.controller.on_filter_change)

        # Radio buttons
        tb.Radiobutton(control_frame, text="Veckor", variable=self.time_scale_var, value="weeks", command=self.controller.on_timescale_change).pack(side=LEFT, padx=5)
        tb.Radiobutton(control_frame, text="Månader", variable=self.time_scale_var, value="months", command=self.controller.on_timescale_change).pack(side=LEFT, padx=5)
        tb.Radiobutton(control_frame, text="År", variable=self.time_scale_var, value="years", command=self.controller.on_timescale_change).pack(side=LEFT, padx=5)

        tb.Checkbutton(control_frame, text="Visa pratbubblor", variable=self.show_annotations_var, command=self.controller.on_annotation_toggle).pack(side=LEFT, padx=10)

        tb.Button(control_frame, text="Visa alla", command=self.controller.reset_filters, bootstyle="warning-outline").pack(side=LEFT, padx=10)
        self.clear_history_btn = tb.Button(control_frame, text="Rensa historik", command=self.controller.clear_history, state="disabled", bootstyle="danger-outline")
        self.clear_history_btn.pack(side=LEFT, padx=5)

        # Export Button (New Feature)
        tb.Button(control_frame, text="PDF Rapport", command=self.controller.export_pdf, bootstyle="success").pack(side=RIGHT, padx=5)

        # Main Content
        paned_window = tb.Panedwindow(self, orient=VERTICAL)
        paned_window.pack(expand=True, fill=BOTH, padx=10, pady=10)

        # Graph Area
        self.graph_frame = tb.Frame(paned_window)
        paned_window.add(self.graph_frame, weight=2)

        # Insights Panel (New Feature)
        self.insights_frame = tb.Labelframe(paned_window, text="Insikter", padding=10, bootstyle="info")
        paned_window.add(self.insights_frame, weight=0) # Small fixed height
        self.insights_label = tb.Label(self.insights_frame, text="Ladda data för att se insikter.", font=("Segoe UI", 10))
        self.insights_label.pack(anchor="w")

        # Table Area
        self.table_frame = tb.Frame(paned_window)
        paned_window.add(self.table_frame, weight=1)

        self.setup_table()

    def setup_table(self):
        columns = ("Article", "Current", "History", "Diff")
        headings = ["Artikelnummer", "Nuvarande", "Historik", "Differens"]

        self.tree = tb.Treeview(self.table_frame, columns=columns, show="headings", selectmode="extended", bootstyle="primary")

        for col, heading in zip(columns, headings):
            self.tree.heading(col, text=heading, command=lambda c=col: self.controller.sort_table(c))
            self.tree.column(col, width=150, anchor="w")

        y_scroll = tb.Scrollbar(self.table_frame, orient="vertical", command=self.tree.yview)
        x_scroll = tb.Scrollbar(self.table_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)

        # Use grid for precise layout to avoid "empty window" artifact
        self.tree.grid(row=0, column=0, sticky=NSEW)
        y_scroll.grid(row=0, column=1, sticky=NS)
        x_scroll.grid(row=1, column=0, sticky=EW)

        # Configure frame expansion
        self.table_frame.grid_rowconfigure(0, weight=1)
        self.table_frame.grid_columnconfigure(0, weight=1)

        # Context menu
        self.menu = Menu(self, tearoff=0)
        self.menu.add_command(label="Visa endast markerade", command=self.controller.filter_selection)
        self.tree.bind("<Button-3>", lambda e: self.menu.post(e.x_root, e.y_root) if self.tree.selection() else None)

    def update_table(self, df):
        # Clear existing
        for item in self.tree.get_children():
            self.tree.delete(item)

        if df.empty:
            return

        for index, row in df.iterrows():
            values = (
                row.iloc[0], # Article
                f"{row['Current']:,.0f}".replace(",", " "),
                f"{row['History']:,.0f}".replace(",", " "),
                f"{row['Diff']:,.0f}".replace(",", " ")
            )
            self.tree.insert("", "end", values=values)

    def update_graph(self, agg_data1, agg_hist):
        self.current_figure = plot_demand(
            agg_data1,
            self.graph_frame,
            self.controller.on_graph_click,
            time_scale=self.time_scale_var.get(),
            data2=agg_hist,
            show_annotations=self.show_annotations_var.get()
        )

    def update_dropdowns(self, periods):
        self.from_combo["values"] = periods
        self.to_combo["values"] = periods

        # Preserve current selection if valid, else select extremes
        current_from = self.from_var.get()
        current_to = self.to_var.get()

        if not periods:
            self.from_var.set("")
            self.to_var.set("")
        else:
            if current_from not in periods:
                self.from_var.set(periods[0])
            if current_to not in periods:
                self.to_var.set(periods[-1])

    def update_insights(self, text):
        self.insights_label.config(text=text)

    def show_loading(self, show=True):
        # Simple cursor change, could be a spinner
        if show:
            self.config(cursor="watch")
            self.title("Efterfrågeanalys - Laddar...")
        else:
            self.config(cursor="")
            self.title("Efterfrågeanalys V0.3")

    def on_closing(self):
        # Save settings
        self.config_manager.set_setting("window_geometry", self.geometry())
        self.config_manager.set_setting("show_annotations", self.show_annotations_var.get())
        self.config_manager.set_setting("time_scale", self.time_scale_var.get())
        self.config_manager.save_settings()
        self.destroy()

    def ask_file(self):
        start_dir = self.config_manager.get_setting("last_folder", "")
        path = filedialog.askopenfilename(title="Välj CSV-fil", filetypes=[("CSV", "*.csv")], initialdir=start_dir)
        if path:
             import os
             self.config_manager.set_setting("last_folder", os.path.dirname(path))
        return path
