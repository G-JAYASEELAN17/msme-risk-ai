import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

# Define feature columns
NUMERICAL_FEATURES = [
    "age",
    "employees",
    "annual_revenue",
    "monthly_cash_flow",
    "monthly_expenses",
    "existing_debt",
    "digital_transactions",
    "utility_payment_score",
    "invoice_payment_score",
    "previous_defaults"
]

CATEGORICAL_FEATURES = [
    "industry"
]

ALL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES

def create_preprocessor():
    """
    Creates a scikit-learn ColumnTransformer for preprocessing MSME financial & alternative data.
    """
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, NUMERICAL_FEATURES),
            ('cat', categorical_transformer, CATEGORICAL_FEATURES)
        ],
        remainder='drop'
    )
    
    return preprocessor

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Performs rigorous data cleaning, schema validation, outlier clipping, and type conversion.
    """
    df = df.copy()
    
    # Handle duplicates if full dataset
    if len(df) > 1:
        df = df.drop_duplicates()
        
    # Ensure all required features are present
    for col in NUMERICAL_FEATURES:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    for col in CATEGORICAL_FEATURES:
        if col not in df.columns:
            df[col] = "Services"
        else:
            df[col] = df[col].astype(str).fillna("Services")
            
    # Handle outliers for numerical columns (clip negative values where inappropriate)
    non_negative_cols = [
        "age", "employees", "annual_revenue", "monthly_expenses",
        "existing_debt", "digital_transactions", "utility_payment_score",
        "invoice_payment_score", "previous_defaults"
    ]
    for col in non_negative_cols:
        if col in df.columns:
            df[col] = np.where(df[col] < 0, 0, df[col])
            
    # Cap score columns to 100
    for col in ["utility_payment_score", "invoice_payment_score"]:
        if col in df.columns:
            df[col] = np.where(df[col] > 100.0, 100.0, df[col])

    # Outlier capping for large datasets
    if len(df) > 50:
        for col in ["annual_revenue", "monthly_expenses", "existing_debt", "digital_transactions"]:
            if col in df.columns:
                upper_limit = df[col].quantile(0.995)
                df[col] = np.where(df[col] > upper_limit, upper_limit, df[col])
            
    return df

