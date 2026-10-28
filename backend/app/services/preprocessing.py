import os
import sys
import joblib
import pandas as pd
import numpy as np
import logging

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from ..config import settings
from ml.preprocessing.preprocess import clean_data, ALL_FEATURES

logger = logging.getLogger(__name__)

class PreprocessingService:
    def __init__(self):
        self.preprocessor = None

    def load_preprocessor(self):
        """Loads the preprocessor/scaler if it is not already loaded."""
        if self.preprocessor is None:
            if not os.path.exists(settings.PREPROCESSOR_PATH):
                logger.warning(f"Preprocessor not found at {settings.PREPROCESSOR_PATH}")
                return None
            self.preprocessor = joblib.load(settings.PREPROCESSOR_PATH)
            # Ensure compatibility across scikit-learn versions for unpickled SimpleImputer instances
            if hasattr(self.preprocessor, "transformers_"):
                for _, trans, _ in self.preprocessor.transformers_:
                    if hasattr(trans, "steps"):
                        for _, step in trans.steps:
                            if hasattr(step, "statistics_") and not hasattr(step, "_fill_dtype"):
                                step._fill_dtype = step.statistics_.dtype
        return self.preprocessor

    def preprocess_single(self, data_dict: dict):
        """
        Cleans and transforms a single dictionary of inputs for ML prediction.
        """
        df = pd.DataFrame([data_dict])
        df_cleaned = clean_data(df)
        
        preprocessor = self.load_preprocessor()
        if preprocessor is None:
            raise FileNotFoundError(f"Preprocessor pipeline file missing at {settings.PREPROCESSOR_PATH}")
            
        transformed = preprocessor.transform(df_cleaned)
        return transformed

preprocessing_service = PreprocessingService()

