import { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5000/api';
const fmt = (n) => n == null ? '₹0' : '₹' + Math.round(n).toLocaleString('en-IN');

export default function AutoAnalyzer({ onResultsReady, showNotification }) {
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [importMethod, setImportMethod] = useState('online');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPhase, setSearchPhase] = useState('');
  const inputRef = useRef(null);
  const suggestionRef = useRef(null);

  // Fetch all products on mount
  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAllProducts(data.products);
        }
      })
      .catch((err) => console.error("Failed to fetch products:", err));
  }, []);

  // Filter products based on query
  useEffect(() => {
    if (!query) {
      setSuggestions(allProducts);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q)
    );
    setSuggestions(filtered);
  }, [query, allProducts]);



  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (product) => {
    setSelectedProduct(product);
    setQuery(product.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleAnalyze = async () => {
    if (!selectedProduct) { showNotification('Please select a product first'); return; }
    setLoading(true);
    onResultsReady(null);

    // Animated search phases
    const phases = [
      '🔍 Searching Amazon, eBay, Walmart...',
      '🌍 Scanning global marketplaces...',
      '💱 Fetching live exchange rates...',
      '🏛️ Calculating customs duty & GST...',
      '📊 Comparing prices across countries...',
    ];
    let phaseIdx = 0;
    setSearchPhase(phases[0]);
    const phaseTimer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, phases.length - 1);
      setSearchPhase(phases[phaseIdx]);
    }, 800);

    try {
      const res = await fetch(`${API_BASE}/auto-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct.id, importMethod })
      });
      const data = await res.json();
      clearInterval(phaseTimer);
      if (data.success) {
        onResultsReady(data);
      } else {
        showNotification('Analysis failed: ' + (data.error || 'Unknown error'));
      }
    } catch {
      clearInterval(phaseTimer);
      showNotification('Could not connect to server.');
    } finally {
      setLoading(false);
      setSearchPhase('');
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelectedProduct(null);
    setSuggestions(allProducts);
    onResultsReady(null);
  };

  return (
    <div className="glass-card auto-analyzer">
      <h2><span className="icon">⚡</span> Global Marketplace Analyzer</h2>
      <p className="analyzer-subtitle">
        Enter a product name — we'll search across <strong>Amazon, eBay, Walmart, Best Buy, Flipkart</strong> and 20+ global stores, then calculate the total import cost for each.
      </p>

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <span className="search-icon">🔎</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            value={query}
            onChange={e => { 
              setQuery(e.target.value); 
              setSelectedProduct(null); 
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (!query) setSuggestions(allProducts);
              setShowSuggestions(true);
            }}
            placeholder="Search any product... e.g., iPhone 16 Pro, MacBook Air, AirPods, Dyson"
            id="product-search"
          />
          {query && <button className="search-clear" onClick={handleClear}>×</button>}
        </div>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown" ref={suggestionRef}>
            {Object.entries(
              suggestions.reduce((acc, p) => {
                if (!acc[p.category]) acc[p.category] = [];
                acc[p.category].push(p);
                return acc;
              }, {})
            ).map(([category, prods]) => (
              <div key={category} className="suggestion-category-group">
                <div className="category-header">{category}</div>
                {prods.map(p => (
                  <div key={p.id} className={`suggestion-item ${selectedProduct?.id === p.id ? 'selected' : ''}`}
                       onClick={() => handleSelect(p)}>
                    <div className="suggestion-name">
                      <span style={{marginRight:'6px'}}>{p.image}</span>
                      {p.name}
                    </div>
                    <div className="suggestion-meta">
                      <span className="suggestion-price">🇮🇳 {fmt(p.indiaPrice)}</span>
                      <span className="suggestion-countries">{p.countries?.length || 0} countries</span>
                      <span className="suggestion-stores">{p.listingCount} stores</span>
                    </div>
                    {p.stores && (
                      <div className="suggestion-stores-list">
                        {p.stores.slice(0, 8).map((s, i) => (
                          <span key={i} className="store-chip">{s}</span>
                        ))}
                        {p.stores.length > 8 && <span className="store-chip more">+{p.stores.length - 8} more</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Product Card */}
      {selectedProduct && (
        <div className="selected-product-card">
          <div className="selected-product-info">
            <h3>{selectedProduct.image} {selectedProduct.name}</h3>
            <div className="selected-product-meta">
              <span className="meta-chip">{selectedProduct.category}</span>
              <span className="meta-chip">🇮🇳 {fmt(selectedProduct.indiaPrice)}</span>
              <span className="meta-chip">📦 {selectedProduct.weight}kg</span>
            </div>
            <div className="marketplace-coverage">
              <span className="coverage-badge">
                🏪 <strong>{selectedProduct.listingCount}</strong> stores across <strong>{selectedProduct.countries?.length || 0}</strong> countries
              </span>
            </div>
            {selectedProduct.stores && (
              <div className="available-currencies" style={{marginTop: '8px'}}>
                {selectedProduct.stores.slice(0, 12).map((s, i) => (
                  <span key={i} className="currency-tag">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Method Toggle */}
      <div className="form-group" style={{marginTop: '20px'}}>
        <label>Buying Method</label>
        <div className="import-method-toggle">
          <button type="button" className={`toggle-option ${importMethod === 'online' ? 'active' : ''}`}
                  onClick={() => setImportMethod('online')}>
            📦 Online Shipping
          </button>
          <button type="button" className={`toggle-option ${importMethod === 'traveller' ? 'active' : ''}`}
                  onClick={() => setImportMethod('traveller')}>
            ✈️ Traveller
          </button>
        </div>
      </div>

      {importMethod === 'traveller' && (
        <div className="traveller-info">
          <strong>✈️ Traveller Mode:</strong> ₹50,000 duty-free allowance. Duty only on value above this limit. No shipping/courier fees.
        </div>
      )}

      {/* Analyze Button */}
      <button className="btn-primary" onClick={handleAnalyze} disabled={loading || !selectedProduct} id="btn-auto-analyze">
        {loading ? (
          <span className="loading-spinner">{searchPhase}</span>
        ) : (
          '⚡ Search All Marketplaces & Compare'
        )}
      </button>
    </div>
  );
}
