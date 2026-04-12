import pandas as pd
import numpy as np
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
import matplotlib.pyplot as plt

df = pd.read_csv("data/eval_dataset.csv")

# Clean data
df = df.dropna(subset=["raw_aqi", "hybrid_aqi", "cpcb_aqi"])

y_true = df["cpcb_aqi"]
y_raw = df["raw_aqi"]
y_hybrid = df["hybrid_aqi"]

def evaluate(name, y_pred):
    r2 = r2_score(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)

    print(f"\n{name} Performance:")
    print(f"R²   : {r2:.4f}")
    print(f"RMSE : {rmse:.2f}")
    print(f"MAE  : {mae:.2f}")

evaluate("RAW AQI", y_raw)
evaluate("HYBRID AQI", y_hybrid)

# Visualization
plt.figure(figsize=(10,5))
plt.plot(df["timestamp"], y_true, label="CPCB AQI", linewidth=2)
plt.plot(df["timestamp"], y_raw, label="Raw AQI", linestyle="dashed")
plt.plot(df["timestamp"], y_hybrid, label="Hybrid AQI")

plt.legend()
plt.xticks(rotation=45)
plt.title("AQI Comparison: Raw vs Hybrid vs CPCB")
plt.tight_layout()
plt.savefig("data/aqi_comparison.png")
print("\nPlot saved to data/aqi_comparison.png")

# Optional: correction impact
df["delta"] = df["hybrid_aqi"] - df["raw_aqi"]
print(f"\nAverage AQI correction (Hybrid - Raw): {df['delta'].mean():.2f}")
