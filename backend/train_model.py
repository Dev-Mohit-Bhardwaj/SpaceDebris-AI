import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import joblib
import os

print("Starting training process...")
data_path = '../data/train_data.csv'

# Select core physical features correlated with risk
features = [
    'time_to_tca', 'miss_distance', 'relative_speed', 
    'relative_position_r', 'relative_position_t', 'relative_position_n',
    'relative_velocity_r', 'relative_velocity_t', 'relative_velocity_n'
]
target = 'risk'

print("Loading data...")
# Read a subset for fast demo training
df = pd.read_csv(data_path, usecols=features + [target], nrows=100000)

print(f"Dataset shape: {df.shape}")
df = df.dropna()

X = df[features]
y = df[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training XGBoost Regressor...")
model = xgb.XGBRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
model.fit(X_train, y_train)

preds = model.predict(X_test)
mse = mean_squared_error(y_test, preds)
print(f"Model MSE: {mse:.4f}")

model_path = 'model.pkl'
joblib.dump(model, model_path)
print(f"Model saved to {model_path}")
