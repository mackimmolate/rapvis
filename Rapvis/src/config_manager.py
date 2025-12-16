
import json
import os

DEFAULT_CONFIG = {
    "article_groups": {
        "Audi AU38": ["8Y1853189D", "8Y1853190M", "8Y1853190P", "8Y2853189M", "8Y2853190D"],
        "VW 380R": ["5H0867439B", "5H0867440B", "5H1858415D", "5H1858415F", "5H1858416F", "5H1858416H", "5H2858415G", "5H2858416E"]
    }
}

DEFAULT_SETTINGS = {
    "theme": "litera",
    "last_folder": "",
    "window_geometry": "1200x800",
    "time_scale": "weeks",
    "show_annotations": True
}

class ConfigManager:
    def __init__(self, config_file="config.json", settings_file="settings.json"):
        self.config_file = config_file
        self.settings_file = settings_file
        self.config = self.load_json(self.config_file, DEFAULT_CONFIG)
        self.settings = self.load_json(self.settings_file, DEFAULT_SETTINGS)

    def load_json(self, filepath, default):
        if not os.path.exists(filepath):
            return default.copy()
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return default.copy()

    def save_settings(self):
        try:
            with open(self.settings_file, "w", encoding="utf-8") as f:
                json.dump(self.settings, f, indent=4)
        except IOError as e:
            print(f"Error saving settings: {e}")

    def get_article_groups(self):
        return self.config.get("article_groups", {})

    def get_setting(self, key, default=None):
        return self.settings.get(key, default)

    def set_setting(self, key, value):
        self.settings[key] = value
