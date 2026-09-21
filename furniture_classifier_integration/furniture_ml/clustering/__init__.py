"""Visual clustering + similarity search.

100% free / local: reuses the trained ``timm`` classifier backbone (or an
ImageNet ``timm`` backbone before training) for embeddings, ``scikit-learn``
for clustering / nearest-neighbours. No cloud APIs.
"""

from furniture_ml.clustering.cluster import ClusterResult, cluster_embeddings
from furniture_ml.clustering.embeddings import BackboneEmbedder
from furniture_ml.clustering.search import SimilarityIndex

__all__ = ["BackboneEmbedder", "ClusterResult", "SimilarityIndex", "cluster_embeddings"]
