import numpy as np
import pandas as pd
import pymc as pm
import arviz as az
import matplotlib.pyplot as plt
import networkx as nx
from scipy import stats
import seaborn as sns

class BayesianDebiasingFramework:
    """
    Implementation of the Bayesian Debiasing Framework for medical diagnostics.
    
    This class encapsulates methods for:
    1. Explicit modeling of confounding variables
    2. Structural causal modeling via DAGs
    3. Hierarchical Bayesian parameter estimation
    4. Conditional inference with bias correction
    """
    
    def __init__(self, variable_names=None):
        """
        Initialize the framework with variable specifications.
        
        Parameters:
        -----------
        variable_names : list
            Names of variables in the model
        """
        self.variable_names = variable_names or []
        self.dag = nx.DiGraph()
        self.model = None
        self.trace = None
        self.bias_factors = None
        
    def define_dag(self, edges):
        """
        Define the directed acyclic graph structure of the model.
        
        Parameters:
        -----------
        edges : list of tuples
            List of (parent, child) relationships to add to the DAG
        """
        self.dag = nx.DiGraph()
        if self.variable_names:
            self.dag.add_nodes_from(self.variable_names)
        self.dag.add_edges_from(edges)
        
        # Verify it's actually a DAG (no cycles)
        if not nx.is_directed_acyclic_graph(self.dag):
            raise ValueError("The defined structure is not a DAG. Check for cycles.")
            
    def visualize_dag(self, figsize=(10, 6)):
        """Visualize the DAG structure."""
        plt.figure(figsize=figsize)
        pos = nx.spring_layout(self.dag)
        nx.draw(self.dag, pos, with_labels=True, node_color='lightblue', 
                node_size=1500, arrowsize=20, font_size=12)
        plt.title("Causal Structure - Directed Acyclic Graph")
        plt.tight_layout()
        return plt.gcf()
        
    def build_hierarchical_model(self, data, model_spec):
        """
        Build a hierarchical Bayesian model using PyMC.
        
        Parameters:
        -----------
        data : pandas.DataFrame
            The dataset containing all variables
            
        model_spec : dict
            Specification of model parameters and priors
        """
        with pm.Model() as self.model:
            # Placeholder for parameters (risk factors)
            theta = {}
            
            # Placeholder for bias factors
            phi = {}
            
            # Example for cancer detection with smoking as confounder
            if 'smoking' in data.columns and 'cancer' in data.columns:
                # Prior for smoking prevalence
                theta['smoking_prev'] = pm.Beta('smoking_prev', alpha=2, beta=5)
                
                # Prior for cancer risk parameters (stratified by smoking)
                theta['cancer_risk_smoking'] = pm.Beta('cancer_risk_smoking', alpha=2, beta=8)
                theta['cancer_risk_nonsmoking'] = pm.Beta('cancer_risk_nonsmoking', alpha=1, beta=10)
                
                # Bias factors in data collection (example)
                # This represents potential sampling bias for smokers vs. non-smokers
                phi['smoking_bias'] = pm.Normal('smoking_bias', mu=0, sigma=0.5)
                
                # Connect smoking status to observed data
                pm.Bernoulli('smoking_obs', 
                            p=theta['smoking_prev'],
                            observed=data['smoking'])
                
                # Cancer probability depends on smoking status
                cancer_p = pm.math.switch(
                    data['smoking'],
                    theta['cancer_risk_smoking'] * (1 + phi['smoking_bias']),
                    theta['cancer_risk_nonsmoking']
                )
                
                # Connect cancer status to observed data
                pm.Bernoulli('cancer_obs', p=cancer_p, observed=data['cancer'])
                
                # If test results are available
                if 'test_result' in data.columns:
                    # Test accuracy parameters (separate for sensitivity/specificity)
                    theta['sens_smoking'] = pm.Beta('sens_smoking', alpha=8, beta=2)
                    theta['sens_nonsmoking'] = pm.Beta('sens_nonsmoking', alpha=8, beta=2)
                    theta['spec_smoking'] = pm.Beta('spec_smoking', alpha=9, beta=1)
                    theta['spec_nonsmoking'] = pm.Beta('spec_nonsmoking', alpha=9, beta=1)
                    
                    # Bias factors in test accuracy
                    phi['test_bias_smoking'] = pm.Normal('test_bias_smoking', mu=0, sigma=0.2)
                    
                    # Test probability depends on cancer status and smoking
                    test_p = pm.math.switch(
                        data['cancer'],
                        # Sensitivity (true positive rate)
                        pm.math.switch(
                            data['smoking'],
                            theta['sens_smoking'] * (1 + phi['test_bias_smoking']),
                            theta['sens_nonsmoking']
                        ),
                        # Specificity (true negative rate)
                        pm.math.switch(
                            data['smoking'],
                            theta['spec_smoking'],
                            theta['spec_nonsmoking']
                        )
                    )
                    
                    # Connect test results to observed data
                    pm.Bernoulli('test_result_obs', p=test_p, observed=data['test_result'])
        
        return self.model
    
    def sample_posterior(self, samples=2000, tune=1000, chains=4, cores=None):
        """
        Sample from the posterior distribution of the model.
        
        Parameters:
        -----------
        samples : int
            Number of samples to draw
        tune : int
            Number of tuning samples
        chains : int
            Number of chains to run
        cores : int
            Number of cores to use (None uses all available)
        """
        if self.model is None:
            raise ValueError("Model not built. Call build_hierarchical_model first.")
            
        with self.model:
            self.trace = pm.sample(
                draws=samples,
                tune=tune,
                chains=chains,
                cores=cores,
                return_inferencedata=True
            )
            
        return self.trace
    
    def extract_bias_factors(self):
        """Extract the bias factors from the posterior samples."""
        if self.trace is None:
            raise ValueError("No posterior samples available. Call sample_posterior first.")
            
        # Extract all variables with 'phi' or 'bias' in the name
        bias_vars = [var for var in self.trace.posterior.variables 
                   if 'phi' in var or 'bias' in var]
        
        self.bias_factors = {var: self.trace.posterior[var].values for var in bias_vars}
        return self.bias_factors
    
    def calculate_debiased_estimates(self, scenario):
        """
        Calculate debiased parameter estimates by marginalizing over bias factors.
        
        Parameters:
        -----------
        scenario : dict
            Dictionary of scenario values to condition on
            
        Returns:
        --------
        dict
            Debiased parameter estimates relevant to the scenario
        """
        if self.trace is None:
            raise ValueError("No posterior samples available. Call sample_posterior first.")
        
        # Example for cancer risk estimation
        if 'smoking' in scenario:
            # Extract relevant parameters
            if scenario['smoking'] == 1:
                risk_samples = self.trace.posterior['cancer_risk_smoking'].values.flatten()
                bias_samples = self.trace.posterior['smoking_bias'].values.flatten()
                
                # Correct for bias by removing the bias factor
                debiased_risk = risk_samples / (1 + bias_samples)
                
                return {
                    'cancer_risk_mean': np.mean(debiased_risk),
                    'cancer_risk_std': np.std(debiased_risk),
                    'cancer_risk_95ci': np.percentile(debiased_risk, [2.5, 97.5])
                }
            else:
                risk_samples = self.trace.posterior['cancer_risk_nonsmoking'].values.flatten()
                
                return {
                    'cancer_risk_mean': np.mean(risk_samples),
                    'cancer_risk_std': np.std(risk_samples),
                    'cancer_risk_95ci': np.percentile(risk_samples, [2.5, 97.5])
                }
        
        return {}
    
    def predict_with_uncertainty(self, new_data):
        """
        Make predictions on new data with uncertainty quantification.
        
        Parameters:
        -----------
        new_data : pandas.DataFrame
            New data to make predictions on
            
        Returns:
        --------
        pandas.DataFrame
            DataFrame with predictions and uncertainty intervals
        """
        results = []
        
        for _, row in new_data.iterrows():
            scenario = row.to_dict()
            debiased_est = self.calculate_debiased_estimates(scenario)
            
            # Add scenario values to results
            result = {k: v for k, v in scenario.items()}
            
            # Add predictions and uncertainty
            if 'smoking' in scenario:
                if scenario['smoking'] == 1:
                    # For smokers
                    result['cancer_risk_debiased'] = debiased_est.get('cancer_risk_mean', np.nan)
                    result['cancer_risk_std'] = debiased_est.get('cancer_risk_std', np.nan)
                    result['cancer_risk_lower'] = debiased_est.get('cancer_risk_95ci', [np.nan, np.nan])[0]
                    result['cancer_risk_upper'] = debiased_est.get('cancer_risk_95ci', [np.nan, np.nan])[1]
                else:
                    # For non-smokers
                    result['cancer_risk_debiased'] = debiased_est.get('cancer_risk_mean', np.nan)
                    result['cancer_risk_std'] = debiased_est.get('cancer_risk_std', np.nan)
                    result['cancer_risk_lower'] = debiased_est.get('cancer_risk_95ci', [np.nan, np.nan])[0]
                    result['cancer_risk_upper'] = debiased_est.get('cancer_risk_95ci', [np.nan, np.nan])[1]
            
            results.append(result)
            
        return pd.DataFrame(results)
    
    def evaluate_fairness_metrics(self, data, prediction_col, target_col, group_col):
        """
        Evaluate fairness metrics across different demographic groups.
        
        Parameters:
        -----------
        data : pandas.DataFrame
            Data with predictions and actual outcomes
        prediction_col : str
            Column name with predictions
        target_col : str
            Column name with actual outcomes
        group_col : str
            Column name for group membership (e.g., 'gender', 'race')
            
        Returns:
        --------
        pandas.DataFrame
            DataFrame with fairness metrics by group
        """
        groups = data[group_col].unique()
        metrics = []
        
        for group in groups:
            group_data = data[data[group_col] == group]
            
            # Calculate standard performance metrics
            true_pos = ((group_data[prediction_col] >= 0.5) & 
                        (group_data[target_col] == 1)).sum()
            false_pos = ((group_data[prediction_col] >= 0.5) & 
                         (group_data[target_col] == 0)).sum()
            true_neg = ((group_data[prediction_col] < 0.5) & 
                        (group_data[target_col] == 0)).sum()
            false_neg = ((group_data[prediction_col] < 0.5) & 
                         (group_data[target_col] == 1)).sum()
            
            # Calculate rates
            if (true_pos + false_neg) > 0:
                tpr = true_pos / (true_pos + false_neg)  # Sensitivity/Recall
            else:
                tpr = np.nan
                
            if (false_pos + true_neg) > 0:
                fpr = false_pos / (false_pos + true_neg)  # Fall-out
            else:
                fpr = np.nan
                
            if (true_pos + false_pos) > 0:
                ppv = true_pos / (true_pos + false_pos)  # Precision
            else:
                ppv = np.nan
            
            metrics.append({
                'group': group,
                'count': len(group_data),
                'true_positive_rate': tpr,
                'false_positive_rate': fpr,
                'positive_predictive_value': ppv,
                'avg_prediction': group_data[prediction_col].mean(),
                'std_prediction': group_data[prediction_col].std()
            })
            
        return pd.DataFrame(metrics)


# Demonstration with a synthetic dataset
def generate_biased_cancer_dataset(n_samples=1000, bias_strength=0.3, seed=42):
    """
    Generate a synthetic biased dataset for cancer detection.
    
    Parameters:
    -----------
    n_samples : int
        Number of samples to generate
    bias_strength : float
        Strength of the bias effect (0-1)
    seed : int
        Random seed for reproducibility
        
    Returns:
    --------
    pandas.DataFrame
        Synthetic dataset with smoking status, cancer status, and test results
    """
    np.random.seed(seed)
    
    # True model parameters
    true_params = {
        'smoking_prev': 0.3,             # Smoking prevalence
        'cancer_risk_smoking': 0.15,     # Cancer risk for smokers
        'cancer_risk_nonsmoking': 0.03,  # Cancer risk for non-smokers
        'sens_smoking': 0.9,             # Test sensitivity for smokers
        'sens_nonsmoking': 0.8,          # Test sensitivity for non-smokers
        'spec_smoking': 0.85,            # Test specificity for smokers
        'spec_nonsmoking': 0.95,         # Test specificity for non-smokers
    }
    
    # Generate demographics
    smoking = np.random.binomial(1, true_params['smoking_prev'], n_samples)
    
    # Generate cancer status (dependent on smoking)
    cancer_prob = np.where(
        smoking == 1, 
        true_params['cancer_risk_smoking'], 
        true_params['cancer_risk_nonsmoking']
    )
    cancer = np.random.binomial(1, cancer_prob, n_samples)
    
    # Generate test results (dependent on cancer and smoking)
    test_prob = np.zeros(n_samples)
    
    # For cancer positive cases
    pos_mask = cancer == 1
    test_prob[pos_mask & (smoking == 1)] = true_params['sens_smoking']
    test_prob[pos_mask & (smoking == 0)] = true_params['sens_nonsmoking']
    
    # For cancer negative cases
    neg_mask = cancer == 0
    test_prob[neg_mask & (smoking == 1)] = 1 - true_params['spec_smoking']
    test_prob[neg_mask & (smoking == 0)] = 1 - true_params['spec_nonsmoking']
    
    # Introduce systematic bias in data collection
    # Smokers are more likely to be in the dataset if they have cancer
    sample_bias = np.ones(n_samples)
    sample_bias[(smoking == 1) & (cancer == 1)] = 1 + bias_strength
    sample_bias[(smoking == 0) & (cancer == 1)] = 1
    sample_bias = sample_bias / np.sum(sample_bias)
    
    # Sample indices with bias
    indices = np.random.choice(
        np.arange(n_samples), 
        size=n_samples, 
        replace=True, 
        p=sample_bias
    )
    
    # Generate test results based on probabilites
    test_result = np.random.binomial(1, test_prob[indices], n_samples)
    
    # Create dataframe
    df = pd.DataFrame({
        'smoking': smoking[indices],
        'cancer': cancer[indices],
        'test_result': test_result
    })
    
    # Check dataset bias
    print("Dataset bias statistics:")
    print(f"Overall cancer rate: {df['cancer'].mean():.4f}")
    print(f"Cancer rate among smokers: {df[df['smoking']==1]['cancer'].mean():.4f}")
    print(f"Cancer rate among non-smokers: {df[df['smoking']==0]['cancer'].mean():.4f}")
    print(f"Test positive rate: {df['test_result'].mean():.4f}")
    
    return df

def main():
    """
    Main demonstration of the Bayesian Debiasing Framework.
    """
    print("Demonstrating the OBINexus Computing Bayesian Debiasing Framework")
    print("===================================================================\n")
    
    # Generate synthetic biased dataset
    print("Step 1: Generating synthetic biased cancer dataset...")
    data = generate_biased_cancer_dataset(n_samples=2000, bias_strength=0.4)
    print("\n")
    
    # Initialize the framework
    print("Step 2: Initializing Bayesian Debiasing Framework...")
    framework = BayesianDebiasingFramework(
        variable_names=['smoking', 'cancer', 'test_result']
    )
    
    # Define the causal structure (DAG)
    print("Step 3: Defining causal structure as a DAG...")
    framework.define_dag([
        ('smoking', 'cancer'),
        ('smoking', 'test_result'),
        ('cancer', 'test_result')
    ])
    
    # Visualize the DAG
    dag_fig = framework.visualize_dag()
    print("DAG visualization generated.")
    
    # Build the hierarchical model
    print("\nStep 4: Building hierarchical Bayesian model...")
    model = framework.build_hierarchical_model(data, model_spec={})
    print("Model built successfully.")
    
    # Sample from the posterior
    print("\nStep 5: Sampling from the posterior distribution...")
    print("This may take a few minutes...")
    # Note: In a real implementation, you would run this sampling process
    # For demonstration, we'll skip the actual sampling as it's computationally intensive
    
    print("\nDemonstration Note: For brevity, we're not running the actual MCMC sampling,")
    print("which would typically take several minutes. In a real implementation, you would")
    print("call framework.sample_posterior() here.")
    
    # Extract bias factors
    print("\nStep 6: Extracting bias factors from posterior...")
    print("Demonstration Note: This would extract bias terms like 'smoking_bias' and")
    print("'test_bias_smoking' from the posterior samples.")
    
    # Make debiased predictions
    print("\nStep 7: Making debiased predictions with uncertainty quantification...")
    print("Demonstration Note: The framework would calculate:")
    print("- Debiased risk estimates by marginalizing over bias parameters")
    print("- Uncertainty intervals to quantify confidence in predictions")
    print("- Performance metrics stratified by demographic groups")
    
    # Evaluate fairness metrics
    print("\nStep 8: Evaluating fairness metrics...")
    print("Demonstration Note: The framework would calculate disparity metrics like:")
    print("- Differences in false negative rates across groups")
    print("- Equal opportunity differences")
    print("- Predictive parity assessments")
    
    print("\n===================================================================")
    print("Full Implementation Capabilities:")
    print("1. Explicit modeling of confounding variables")
    print("2. Structural causal modeling through directed acyclic graphs")
    print("3. Hierarchical Bayesian parameter estimation")
    print("4. Bias factor identification and correction")
    print("5. Uncertainty quantification in predictions")
    print("6. Fairness metric evaluation across demographic groups")
    
    print("\nThis demonstration provides the implementation structure.")
    print("For production use, you would:")
    print("1. Run the full sampling procedure")
    print("2. Analyze real data with appropriate domain knowledge")
    print("3. Monitor bias metrics over time")
    print("4. Integrate with existing ML pipelines")
    
    print("\nEnd of Demonstration")

if __name__ == "__main__":
    main()
