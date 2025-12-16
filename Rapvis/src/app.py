# app.py

import tkinter as tk
import pandas as pd
import numpy as np
from tkinter import ttk, filedialog, Menu, messagebox
import sys

from data_processing import (
    load_data,
    aggregate_data,
    normalize_articles,
    add_period_string,
    get_period_strings,
)
from visualization import plot_demand
from config import AUDI_NORMALIZED, VW_NORMALIZED

class DemandAnalysisApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Efterfrågeanalys V0.2")
        self.root.geometry("1200x800")
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # ===== NY KOD FÖR ATT ÄNDRA TEXTSTORLEK I TABELLEN =====
        try:
            style = ttk.Style(self.root)
            
            # Konfigurera texten för kolumnrubrikerna
            style.configure("Treeview.Heading", 
                            font=("Segoe UI", 12,)) # Typsnitt, storlek, stil

            # Konfigurera texten för data i raderna
            # 'rowheight' hjälper till att ge texten mer utrymme på höjden
            style.configure("Treeview", 
                            font=("Segoe UI", 11)),
        except tk.TclError:
            # Denna rad finns för säkerhets skull om programmet körs utan GUI
            print("Kunde inte applicera ttk-stilar.")
        # ===== SLUT PÅ NY KOD =====

        # Variabler för data och state
        self.file1_data = pd.DataFrame()
        self.history_data = pd.DataFrame()
        self.selected_articles = []
        self.article_col = "Article number buyer"
        
        # FIX: Infört state-variabler för att hålla reda på vad tabellen visar
        self.table_view_data1 = pd.DataFrame()
        self.table_view_data2 = pd.DataFrame()
        
        # Variabler för UI-kontroller
        self.time_scale_var = tk.StringVar(value="weeks")
        self.time_scale_var.trace_add("write", self.on_timescale_change)
        self.article_var = tk.StringVar(value="Alla")
        self.from_var = tk.StringVar()
        self.to_var = tk.StringVar()
        self.show_annotations_var = tk.BooleanVar(value=True) # New variable for annotations

        # Variabler för sortering av tabell
        self.sort_column_name = None
        self.sort_reverse = False

        self.create_widgets()

    def on_closing(self):
        """Körs när fönstret stängs, säkerställer att appen avslutas."""
        self.root.destroy()
        sys.exit(0)

    def create_widgets(self):
        # Kontrollram överst
        control_frame = ttk.Frame(self.root, padding="10")
        control_frame.pack(fill=tk.X)

        ttk.Button(control_frame, text="Ladda förfrågan", command=self.load_file1).pack(side=tk.LEFT, padx=5)
        self.load_history_btn = ttk.Button(control_frame, text="Ladda historik", command=self.load_history_file)
        self.load_history_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.article_combo = ttk.Combobox(control_frame, textvariable=self.article_var, state="readonly", values=["Audi AU38", "VW 380R", "Övrigt", "Alla"])
        self.article_combo.pack(side=tk.LEFT, padx=5)
        self.article_combo.bind("<<ComboboxSelected>>", self.update_view)

        ttk.Label(control_frame, text="Från:").pack(side=tk.LEFT, padx=(10, 2))
        self.from_combo = ttk.Combobox(control_frame, textvariable=self.from_var, state="readonly", width=10)
        self.from_combo.pack(side=tk.LEFT, padx=2)
        self.from_combo.bind("<<ComboboxSelected>>", self.on_period_range_change)

        ttk.Label(control_frame, text="Till:").pack(side=tk.LEFT, padx=2)
        self.to_combo = ttk.Combobox(control_frame, textvariable=self.to_var, state="readonly", width=10)
        self.to_combo.pack(side=tk.LEFT, padx=2)
        self.to_combo.bind("<<ComboboxSelected>>", self.on_period_range_change)
        
        ttk.Radiobutton(control_frame, text="Veckor", variable=self.time_scale_var, value="weeks").pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(control_frame, text="Månader", variable=self.time_scale_var, value="months").pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(control_frame, text="År", variable=self.time_scale_var, value="years").pack(side=tk.LEFT, padx=5)

        # New Checkbutton for annotations
        ttk.Checkbutton(control_frame, text="Visa pratbubblor", variable=self.show_annotations_var, command=self.update_view).pack(side=tk.LEFT, padx=10)

        ttk.Button(control_frame, text="Visa alla", command=self.show_all_articles).pack(side=tk.LEFT, padx=10)
        self.clear_history_btn = ttk.Button(control_frame, text="Ta bort historik", command=self.clear_history, state="disabled")
        self.clear_history_btn.pack(side=tk.LEFT, padx=5)

        # PanedWindow för justerbar vy
        paned_window = ttk.PanedWindow(self.root, orient=tk.VERTICAL)
        paned_window.pack(expand=True, fill=tk.BOTH)

        self.graph_frame = ttk.Frame(paned_window)
        paned_window.add(self.graph_frame, weight=2)
        self.table_frame = ttk.Frame(paned_window)
        paned_window.add(self.table_frame, weight=1)

        self.setup_table_widget()
        self.create_context_menu()
        
    def setup_table_widget(self):
        """Skapar och konfigurerar Treeview-widgeten för tabellen."""
        for widget in self.table_frame.winfo_children():
            widget.destroy()

        self.columns = ("Article", "Current", "History", "Diff")
        self.headings = ["Artikelnummer", "Nuvarande", "Historik", "Differens"]
        
        self.tree = ttk.Treeview(self.table_frame, columns=self.columns, show="headings", selectmode="extended")
        
        for col, heading in zip(self.columns, self.headings):
            self.tree.heading(col, text=heading, command=lambda c=col: self.sort_table_column(c))
            self.tree.column(col, width=150, anchor="w")

        y_scrollbar = ttk.Scrollbar(self.tree, orient="vertical", command=self.tree.yview)
        x_scrollbar = ttk.Scrollbar(self.tree, orient="horizontal", command=self.tree.xview)
        y_scrollbar.pack(side="right", fill="y")
        x_scrollbar.pack(side="bottom", fill="x")
        self.tree.configure(yscrollcommand=y_scrollbar.set, xscrollcommand=x_scrollbar.set)
        self.tree.pack(expand=True, fill=tk.BOTH)
        
        self.tree.bind("<Button-3>", self.show_context_menu)

    def create_context_menu(self):
        self.menu = Menu(self.root, tearoff=0)
        self.menu.add_command(label="Visa endast markerade", command=self.show_selected_articles)

    def show_context_menu(self, event):
        if self.tree.selection():
            self.menu.post(event.x_root, event.y_root)

    def show_selected_articles(self):
        selected_items = self.tree.selection()
        if selected_items:
            self.selected_articles = [self.tree.item(item, "values")[0] for item in selected_items]
            self.update_view()
    
    def show_all_articles(self):
        self.selected_articles = []
        self.tree.selection_set()
        self.update_view()

    def clear_history(self):
        self.history_data = pd.DataFrame()
        self.clear_history_btn.config(state="disabled")
        self.update_view()

    def load_file(self, is_history=False):
        """Gemensam funktion för filinläsning med felhantering."""
        file_path = filedialog.askopenfilename(title="Välj en CSV-fil", filetypes=[("CSV files", "*.csv")])
        if not file_path:
            return

        try:
            data, article_col = load_data(file_path, return_article_col=True)
            if is_history:
                self.history_data = data
                self.clear_history_btn.config(state="normal")
            else:
                self.file1_data = data
                self.article_col = article_col
            self.update_dropdowns()
            self.update_view()
        except Exception as e:
            messagebox.showerror("Fel vid inläsning", f"Kunde inte ladda filen:\n{e}\n\nKontrollera att filen är en korrekt formaterad CSV.")

    def load_file1(self):
        self.load_file(is_history=False)

    def load_history_file(self):
        self.load_file(is_history=True)

    def on_timescale_change(self, *args):
        self.update_dropdowns()
        self.update_view()

    def update_dropdowns(self):
        if self.file1_data.empty:
            return
        scale = self.time_scale_var.get()
        all_data = pd.concat([self.file1_data, self.history_data]) if not self.history_data.empty else self.file1_data
        periods = get_period_strings(all_data, scale)
        
        self.from_combo["values"] = periods
        self.to_combo["values"] = periods

        if periods:
            self.from_var.set(periods[0])
            self.to_var.set(periods[-1])
        else:
            self.from_var.set("")
            self.to_var.set("")
        self.on_period_range_change()

    def on_period_range_change(self, event=None):
        frm = self.from_var.get()
        to = self.to_var.get()
        if frm and to and frm > to:
            self.from_var.set(to)
            self.to_var.set(frm)
        self.update_view()

    def update_view(self, event=None):
        """Huvudfunktion för att filtrera data och uppdatera graf och tabell."""
        if self.file1_data.empty:
            return

        scale = self.time_scale_var.get()
        
        filtered_data1 = self.file1_data[self.build_filter_mask(self.file1_data)]
        filtered_history = self.history_data[self.build_filter_mask(self.history_data)] if not self.history_data.empty else pd.DataFrame()
        
        agg_data1 = aggregate_data(filtered_data1, time_scale=scale)
        agg_hist = aggregate_data(filtered_history, time_scale=scale)

        plot_demand(agg_data1, self.graph_frame, self.update_table_for_selection, time_scale=scale, data2=agg_hist, show_annotations=self.show_annotations_var.get())
        
        # **FIX:** Uppdatera state för tabellen med den övergripande, filtrerade datan
        self.table_view_data1 = filtered_data1
        self.table_view_data2 = filtered_history
        self._populate_comparison_table(self.table_view_data1, self.table_view_data2)


    def build_filter_mask(self, df):
        """Bygger en boolean mask för att filtrera en DataFrame baserat på UI-val."""
        df_temp = add_period_string(df.copy(), self.time_scale_var.get())
        mask = pd.Series(True, index=df_temp.index)
        
        frm, to = self.from_var.get(), self.to_var.get()
        if frm and to:
            mask &= (df_temp["PeriodString"] >= frm) & (df_temp["PeriodString"] <= to)

        if self.selected_articles:
            selected_norm = {normalize_articles(pd.Series([a])).iloc[0] for a in self.selected_articles}
            mask &= df_temp["ArticleNormalized"].isin(selected_norm)
        else:
            selection = self.article_var.get()
            if selection == "Audi AU38":
                mask &= df_temp["ArticleNormalized"].isin(AUDI_NORMALIZED)
            elif selection == "VW 380R":
                mask &= df_temp["ArticleNormalized"].isin(VW_NORMALIZED)
            elif selection == "Övrigt":
                mask &= ~df_temp["ArticleNormalized"].isin(AUDI_NORMALIZED | VW_NORMALIZED)
        return mask

    def _populate_comparison_table(self, current_df, history_df):
        """
        En "dum" funktion som bara visar den data den får. All filtrering sker innan.
        """
        for i in self.tree.get_children():
            self.tree.delete(i)

        if (current_df is None or current_df.empty) and (history_df is None or history_df.empty):
            self.update_sort_indicator()
            return

        curr = pd.Series(dtype='float64')
        if current_df is not None and not current_df.empty:
            curr = current_df.groupby(self.article_col)["Demand"].sum()

        hist = pd.Series(dtype='float64')
        if history_df is not None and not history_df.empty:
            hist = history_df.groupby(self.article_col)["Demand"].sum()
            
        merged = pd.concat([curr.rename("Current"), hist.rename("History")], axis=1).fillna(0)
        merged["Diff"] = merged["Current"] - merged["History"]
            
        merged = merged.reset_index().rename(columns={"index": self.article_col})
        
        if self.sort_column_name:
            sort_by_col_map = {"Article": self.article_col, "Current": "Current", "History": "History", "Diff": "Diff"}
            sort_by_col = sort_by_col_map.get(self.sort_column_name)
            
            if sort_by_col:
                ascending = not self.sort_reverse
                if sort_by_col != self.article_col:
                    merged = merged.sort_values(by=sort_by_col, ascending=ascending)
                else:
                    merged = merged.sort_values(by=sort_by_col, ascending=ascending, key=lambda x: x.astype(str).str.lower())
        
        for index, row in merged.iterrows():
            values = (
                row[self.article_col],
                f"{row['Current']:,.0f}".replace(",", " "),
                f"{row['History']:,.0f}".replace(",", " "),
                f"{row['Diff']:,.0f}".replace(",", " ")
            )
            self.tree.insert("", "end", values=values)
            
        self.update_sort_indicator()

    def update_table_for_selection(self, selected_data1, selected_data2):
        """Anropas när användaren klickar i grafen."""
        # **FIX:** Uppdatera state för tabellen med den klick-specifika datan
        self.table_view_data1 = selected_data1
        self.table_view_data2 = selected_data2
        self._populate_comparison_table(self.table_view_data1, self.table_view_data2)

    def sort_table_column(self, col):
        """Hanterar sortering och uppdaterar rubrik med pil."""
        if self.sort_column_name == col:
            self.sort_reverse = not self.sort_reverse
        else:
            self.sort_column_name = col
            self.sort_reverse = False
        
        # **FIX:** Anropa alltid populate med den sparade state-datan
        self._populate_comparison_table(self.table_view_data1, self.table_view_data2)

    def update_sort_indicator(self):
        """Uppdaterar kolumnrubrikerna för att visa sorteringsindikator."""
        for col, heading in zip(self.columns, self.headings):
            if col == self.sort_column_name:
                arrow = "▼" if self.sort_reverse else "▲"
                self.tree.heading(col, text=f"{heading} {arrow}")
            else:
                self.tree.heading(col, text=heading)

def main():
    root = tk.Tk()
    app = DemandAnalysisApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
