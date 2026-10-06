import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import joblib

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from ml.preprocessing.preprocess import create_preprocessor, clean_data, NUMERICAL_FEATURES, CATEGORICAL_FEATURES

def generate_synthetic_data(num_samples=2000, random_seed=42):
    """
    Generates a realistic synthetic dataset for MSME loan default risk.
    """
    np.random.seed(random_seed)
    
    # 1. Base business indicators
    industries = np.random.choice(['Manufacturing', 'Retail', 'Logistics', 'Services'], size=num_samples, p=[0.25, 0.40, 0.15, 0.20])
    age = np.random.exponential(scale=6, size=num_samples) + 1
    age = np.clip(age, 1, 30).astype(int)
    
    employees = (age * np.random.randint(2, 7, size=num_samples) + np.random.randint(1, 10, size=num_samples)).astype(int)
    employees = np.clip(employees, 1, 200)
    
    # 2. Financial indicators
    annual_revenue = employees * np.random.uniform(35000, 140000, size=num_samples)
    annual_revenue = np.round(annual_revenue, -3)
    
    monthly_expenses = (annual_revenue / 12) * np.random.uniform(0.55, 0.88, size=num_samples)
    monthly_expenses = np.round(monthly_expenses, -2)
    
    monthly_cash_flow = (annual_revenue / 12) - monthly_expenses + np.random.normal(scale=8000, size=num_samples)
    monthly_cash_flow = np.round(monthly_cash_flow, -2)
    
    existing_debt = annual_revenue * np.random.uniform(0.05, 0.55, size=num_samples)
    # Higher debt for some riskier businesses
    high_debt_idx = np.random.choice(num_samples, size=int(num_samples * 0.18), replace=False)
    existing_debt[high_debt_idx] *= np.random.uniform(1.4, 2.8)
    existing_debt = np.round(existing_debt, -3)
    
    # 3. Alternative indicators
    digital_transactions = np.random.randint(15, 950, size=num_samples)
    
    utility_payment_score = np.random.beta(a=5, b=2, size=num_samples) * 100
    utility_payment_score = np.clip(utility_payment_score, 10, 100)
    
    invoice_payment_score = np.random.beta(a=4.5, b=2, size=num_samples) * 100
    invoice_payment_score = np.clip(invoice_payment_score, 10, 100)
    
    previous_defaults = np.random.choice([0, 1, 2, 3], size=num_samples, p=[0.82, 0.12, 0.04, 0.02])
    
    df = pd.DataFrame({
        "industry": industries,
        "age": age,
        "employees": employees,
        "annual_revenue": annual_revenue,
        "monthly_cash_flow": monthly_cash_flow,
        "monthly_expenses": monthly_expenses,
        "existing_debt": existing_debt,
        "digital_transactions": digital_transactions,
        "utility_payment_score": utility_payment_score,
        "invoice_payment_score": invoice_payment_score,
        "previous_defaults": previous_defaults
    })
    
    # 4. Deterministic + Noise Ground Truth Target
    norm_debt_to_rev = existing_debt / (annual_revenue + 1)
    norm_cf_to_exp = monthly_cash_flow / (monthly_expenses + 1)
    
    risk_score = (
        (norm_debt_to_rev * 3.2)
        - (np.log1p(age) * 0.45)
        - (utility_payment_score / 100.0 * 2.2)
        - (invoice_payment_score / 100.0 * 1.8)
        - (norm_cf_to_exp * 1.6)
        + (previous_defaults * 2.8)
        + np.random.normal(scale=0.7, size=num_samples)
    )
    
    prob_default = 1 / (1 + np.exp(-risk_score))
    threshold = np.percentile(prob_default, 80)
    default_status = (prob_default >= threshold).astype(int)
    df['default'] = default_status
    
    return df

def train_and_evaluate():
    print("Generating synthetic MSME alternative financial dataset...")
    df_raw = generate_synthetic_data(num_samples=2500)
    
    # Path resolution
    current_file_dir = os.path.dirname(os.path.abspath(__file__)) # backend/ml/training
    backend_root = os.path.dirname(os.path.dirname(current_file_dir)) # backend
    project_root = os.path.dirname(backend_root) # project-mini root
    
    data_raw_dir = os.path.join(project_root, "data", "raw")
    data_proc_dir = os.path.join(project_root, "data", "processed")
    models_dir = os.path.join(backend_root, "ml", "models")
    
    os.makedirs(data_raw_dir, exist_ok=True)
    os.makedirs(data_proc_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)
    
    raw_path = os.path.join(data_raw_dir, "msme_loans_raw.csv")
    df_raw.to_csv(raw_path, index=False)
    print(f"Raw data saved to: {raw_path}")
    
    # Clean data
    df_clean = clean_data(df_raw)
    clean_path = os.path.join(data_proc_dir, "msme_loans_clean.csv")
    df_clean.to_csv(clean_path, index=False)
    print(f"Cleaned data saved to: {clean_path}")
    
    X = df_clean.drop(columns=["default"])
    y = df_clean["default"]
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Fit preprocessor
    print("Fitting preprocessing ColumnTransformer pipeline...")
    preprocessor = create_preprocessor()
    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)
    
    # Save preprocessor
    preprocessor_path = os.path.join(models_dir, "scaler.joblib")
    joblib.dump(preprocessor, preprocessor_path)
    print(f"Preprocessor saved to: {preprocessor_path}")
    
    # Train candidate models
    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42),
        "Decision Tree": DecisionTreeClassifier(class_weight='balanced', max_depth=6, random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=150, max_depth=8, class_weight='balanced', random_state=42)
    }
    
    try:
        from xgboost import XGBClassifier
        pos_weight = float((len(y_train) - sum(y_train)) / max(sum(y_train), 1))
        models["XGBoost"] = XGBClassifier(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.08,
            scale_pos_weight=pos_weight,
            random_state=42,
            eval_metric='logloss'
        )
        print("XGBoost is available and included in evaluation.")
    except ImportError:
        print("XGBoost not installed. Skipping XGBoost.")
        
    results = {}
    best_model_name = ""
    best_roc_auc = 0.0
    best_model = None
    
    print("\n" + "=" * 70)
    print(f"{'Model':<22} | {'Accuracy':<8} | {'Precision':<9} | {'Recall':<8} | {'F1':<8} | {'ROC-AUC':<8}")
    print("-" * 70)
    
    for name, model in models.items():
        model.fit(X_train_proc, y_train)
        y_pred = model.predict(X_test_proc)
        y_prob = model.predict_proba(X_test_proc)[:, 1]
        
        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        auc = float(roc_auc_score(y_test, y_prob))
        cm = confusion_matrix(y_test, y_pred).tolist()
        
        print(f"{name:<22} | {acc:.4f}   | {prec:.4f}    | {rec:.4f}   | {f1:.4f}   | {auc:.4f}")
        
        results[name] = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
            "confusion_matrix": cm
        }
        
        if auc > best_roc_auc:
            best_roc_auc = auc
            best_model_name = name
            best_model = model
            
    print("=" * 70)
    print(f"\nOptimal Best Model: {best_model_name} with ROC-AUC {best_roc_auc:.4f}")
    
    # Save best model
    model_path = os.path.join(models_dir, "model.joblib")
    joblib.dump(best_model, model_path)
    print(f"Saved best model artifact to: {model_path}")
    
    # Save model metadata
    model_version = "1.1.0"
    metadata = {
        "model_version": model_version,
        "best_model": best_model_name,
        "best_roc_auc": round(best_roc_auc, 4),
        "evaluation_metrics": results[best_model_name],
        "all_model_results": results,
        "features": {
            "numerical": NUMERICAL_FEATURES,
            "categorical": CATEGORICAL_FEATURES
        },
        "training_samples": len(df_raw),
        "test_samples": len(X_test),
        "trained_at": pd.Timestamp.now().isoformat()
    }
    
    metadata_path = os.path.join(models_dir, "model_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved model metadata to: {metadata_path}")
    
    summary_path = os.path.join(data_proc_dir, "training_summary.json")
    with open(summary_path, "w") as f:
        json.dump(metadata, f, indent=2)
        
    print("\nTraining and validation pipeline executed successfully!")
    return metadata

if __name__ == "__main__":
    train_and_evaluate()

