import { useState, useMemo, useEffect } from 'react';
import Reviews from './Reviews';
import DailyStockManager from './DailyStockManager';
import SmartFishNameInput from './SmartFishNameInput';
import FishImageUpload from './FishImageUpload';
import FirestoreDiagnostics from './FirestoreDiagnostics';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import { uploadOwnerPhoto } from '../utils/cloudinaryUpload';
import SideMenu from './SideMenu';
import { 
  saveDiscountSettings, 
  savePromotionBanner, 
  saveShopSetting,
  subscribeToDiscountSettings,
  subscribeToPromotionBanner,
  subscribeToShopSetting,
  addRateHistoryEntry
} from '../services/firestoreService';
import {
  downloadCollectionData,
  uploadCollectionData,
  downloadAllCollections,
  uploadAllCollections
} from '../utils/firestoreBackup';
import BulkRateUpdateForm from './BulkRateUpdateForm';
import AdminOffers from './AdminOffers';
import AdminOrders from './AdminOrders';

const AdminPanel = ({ fishData, refreshFishData, onLogout }) => {
  const [activeTab, setActiveTab] = useState('fishes');
  const [promoSection, setPromoSection] = useState('basket'); // basket | banner | offers
  const [editingFish, setEditingFish] = useState(null);
  const [showAddFish, setShowAddFish] = useState(false);
  const [selectedFish, setSelectedFish] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFishId, setLoadingFishId] = useState(null); // Track which fish is being processed
  const [isAddingFish, setIsAddingFish] = useState(false); // Track if adding a new fish

  const handleAddFish = async (newFish) => {
    setIsAddingFish(true);
    try {
      // Add fish directly to Firestore
      const { addFish } = await import('../services/firestoreService');
      await addFish(newFish);
      
      // Refresh fish list from Firestore
      await refreshFishData();
      
      setShowAddFish(false);
    } catch (error) {
      console.error('Error adding fish:', error);
      alert('Failed to add fish. Please try again.');
    } finally {
      setIsAddingFish(false);
    }
  };

  const handleEditFish = async (updatedFish) => {
    setLoadingFishId(updatedFish.id);
    try {
      // Find original fish to check for rate changes
      const originalFish = fishData.fishes.find(f => f.id === updatedFish.id);
      
      // Create rate history entry in Firestore if rate changed
      if (originalFish && originalFish.rate !== updatedFish.rate) {
        try {
          // Build rate history payload dynamically from form data
          const rateHistoryPayload = {
            fishId: updatedFish.id,
            fishName: updatedFish.name,
            oldRate: originalFish.rate,
            newRate: updatedFish.rate,
            timestamp: new Date().toISOString(),
            updatedBy: 'admin'
          };
          
          // Save to rateHistory collection
          await addRateHistoryEntry(rateHistoryPayload);
          console.log('✅ Rate history entry created');
        } catch (rateHistoryError) {
          console.error('Error creating rate history entry:', rateHistoryError);
          // Don't fail the whole operation if rate history fails
        }
        
        // Also update local rateHistory array for backward compatibility
        updatedFish.rateHistory = [
          {
            date: new Date().toISOString(),
            rate: updatedFish.rate,
            updatedBy: 'admin'
          },
          ...(originalFish.rateHistory || [])
        ];
      }
      
      // Update fish directly in Firestore
      const { updateFish } = await import('../services/firestoreService');
      await updateFish(updatedFish.id, updatedFish);
      
      // Refresh fish list from Firestore
      await refreshFishData();
      
      setEditingFish(null);
    } catch (error) {
      console.error('Error updating fish:', error);
      alert('Failed to update fish. Please try again.');
    } finally {
      setLoadingFishId(null);
    }
  };

  const handleDeleteFish = async (fishId) => {
    if (window.confirm('Are you sure you want to delete this fish?')) {
      setLoadingFishId(fishId);
      try {
        // Delete fish directly from Firestore
        const { deleteFish } = await import('../services/firestoreService');
        await deleteFish(fishId);
        
        // Refresh fish list from Firestore
        await refreshFishData();
      } catch (error) {
        console.error('Error deleting fish:', error);
        alert('Failed to delete fish. Please try again.');
      } finally {
        setLoadingFishId(null);
      }
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(fishData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fishData.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          // Import data using bulk import utility
          const { bulkImportFish, fishImportData } = await import('../utils/bulkImportFish');
          // Use the imported data or fallback to fishImportData
          const dataToImport = importedData.fishes || importedData || fishImportData;
          await bulkImportFish(dataToImport);
          
          // Refresh fish list from Firestore
          await refreshFishData();
          alert('Data imported successfully!');
        } catch (error) {
          console.error('Error importing data:', error);
          alert('Error importing data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Bulk operations
  const handleSelectFish = (fishId) => {
    setSelectedFish(prev => 
      prev.includes(fishId) 
        ? prev.filter(id => id !== fishId)
        : [...prev, fishId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFish.length === fishData.fishes.length) {
      setSelectedFish([]);
    } else {
      setSelectedFish(fishData.fishes.map(fish => fish.id));
    }
  };

  const handleBulkAction = async () => {
    if (selectedFish.length === 0) {
      alert('Please select fish to perform bulk action');
      return;
    }

    try {
      const { updateFish, deleteFish } = await import('../services/firestoreService');

      switch (bulkAction) {
        case 'delete':
          if (window.confirm(`Are you sure you want to delete ${selectedFish.length} fish?`)) {
            // Delete each fish directly from Firestore
            for (const fishId of selectedFish) {
              await deleteFish(fishId);
            }
            await refreshFishData();
            setSelectedFish([]);
          }
          break;
        case 'toggle_stock':
          // Update each fish's stock status in Firestore (single-record updates)
          for (const fishId of selectedFish) {
            const fish = fishData.fishes.find(f => f.id === fishId);
            if (fish) {
              const newAvailable = !(fish.available !== undefined ? fish.available : fish.inStock);
              // Only update the available field - updateFish handles single-record update
              await updateFish(fishId, { 
                available: newAvailable
              });
            }
          }
          await refreshFishData();
          setSelectedFish([]);
          break;
        case 'update_category':
          const newCategory = prompt('Enter new category (Seawater/Freshwater):');
          if (newCategory && ['Seawater', 'Freshwater'].includes(newCategory)) {
            // Update each fish's category in Firestore
            for (const fishId of selectedFish) {
              await updateFish(fishId, { category: newCategory });
            }
            await refreshFishData();
            setSelectedFish([]);
          }
          break;
        case 'update_price':
          const priceChange = prompt('Enter price change (e.g., +50, -20, or 100):');
          if (priceChange) {
            // Update each fish's price in Firestore
            for (const fishId of selectedFish) {
              const fish = fishData.fishes.find(f => f.id === fishId);
              if (fish) {
                let newPrice = fish.rate;
                if (priceChange.startsWith('+')) {
                  newPrice = fish.rate + parseInt(priceChange.slice(1));
                } else if (priceChange.startsWith('-')) {
                  newPrice = fish.rate - parseInt(priceChange.slice(1));
                } else {
                  newPrice = parseInt(priceChange);
                }
                await updateFish(fishId, { rate: Math.max(0, newPrice) });
              }
            }
            await refreshFishData();
            setSelectedFish([]);
          }
          break;
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('Failed to perform bulk action. Please try again.');
    }
    
    setShowBulkModal(false);
    setBulkAction('');
  };

  // Memoize filtered fish results for instant search
  const { filteredFishes, matchCount } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    // Filter fish based on search query
    let filtered = fishData.fishes;
    if (query) {
      filtered = fishData.fishes.filter(fish => 
        (fish.name || '').toLowerCase().includes(query)
      );
    }
    
    // Sort by name in ascending order
    const sorted = [...filtered].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    return { 
      filteredFishes: sorted, 
      matchCount: filtered.length 
    };
  }, [searchQuery, fishData.fishes]);

  return (
    <div className="min-h-screen bg-cyan-50">
      <SideMenu
        onNavigate={(tabId) => {
          if (tabId) {
            setActiveTab(tabId);
          }
        }}
        onLogout={onLogout}
        adminInfo={{
          name: fishData?.shopInfo?.owner,
          email: fishData?.shopInfo?.email,
        }}
      />
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Last updated: {new Date(fishData.shopInfo.updatedOn).toLocaleString('en-IN')}
              </span>
              <button
                onClick={onLogout}
                className="btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'fishes' && (() => {

          return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Fish Management</h2>
              <div className="flex space-x-3">
                {selectedFish.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{selectedFish.length} selected</span>
                    <button
                      onClick={() => setShowBulkModal(true)}
                      className="btn-secondary text-sm"
                    >
                      Bulk Actions
                    </button>
                    <button
                      onClick={() => setSelectedFish([])}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="btn-secondary"
                  title="Refresh from Firestore"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => setShowAddFish(true)}
                  className="btn-primary"
                >
                  Add New Fish
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="card p-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search fish by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold text-blue-600">{matchCount} matching</span> out of {fishData.fishes.length} total fish
                </div>
              )}
            </div>

            {/* Add Fish Form */}
            {showAddFish && (
              <div className="card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Fish</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  
                  // Get image URL - component handles priority (local path > cloud URL)
                  const imageUrl = formData.get('image') || '';
                  
                  const newFish = {
                    name: formData.get('name'),
                    category: formData.get('category'),
                    rate: parseInt(formData.get('rate')),
                    unit: formData.get('unit')?.toUpperCase() || 'KG',
                    image: imageUrl,
                    available: formData.get('available') === 'on',
                    inStock: formData.get('available') === 'on', // Keep for backward compatibility
                    Fish_description: formData.get('Fish_description') || '',
                    Other_info: formData.get('Other_info') || '',
                    description: formData.get('Fish_description') || '' // Keep for backward compatibility
                  };
                  handleAddFish(newFish);
                }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fish Name</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        name="category"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      >
                        <option value="Seawater">Seawater</option>
                        <option value="Freshwater">Freshwater</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rate (₹)</label>
                      <input
                        type="number"
                        name="rate"
                        required
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                      <select
                        name="unit"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                        defaultValue="KG"
                      >
                        <option value="KG">KG</option>
                        <option value="PER KG">PER KG</option>
                        <option value="PIECE">PIECE</option>
                      </select>
                    </div>
                  </div>
                  <input type="hidden" name="image" />
                  <FishImageUpload
                    id="add-fish-image"
                    label="Fish Image"
                    value=""
                    onChange={(imageUrl) => {
                      // Update hidden input for form submission
                      const form = document.querySelector('form');
                      if (form) {
                        const hiddenInput = form.querySelector('input[name="image"]');
                        if (hiddenInput) {
                          hiddenInput.value = imageUrl;
                        }
                      }
                    }}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fish Description</label>
                    <textarea
                      name="Fish_description"
                      rows={3}
                      placeholder="Fish benefits, nutritional info, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Other Info</label>
                    <textarea
                      name="Other_info"
                      rows={3}
                      placeholder="Additional information, storage tips, cooking suggestions, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="available"
                      defaultChecked
                      className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">Available</label>
                  </div>
                  <div className="flex space-x-4">
                    <button 
                      type="submit" 
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isAddingFish}
                    >
                      {isAddingFish ? 'Adding...' : 'Add Fish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddFish(false)}
                      className="btn-secondary"
                      disabled={isAddingFish}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Fish Form */}
            {editingFish && (
              <div className="card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Fish</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  
                  // Get image URL - component handles priority (local path > cloud URL)
                  const imageUrl = formData.get('image') || editingFish.image || '';
                  
                  const updatedFish = {
                    ...editingFish,
                    name: formData.get('name'),
                    category: formData.get('category'),
                    rate: parseInt(formData.get('rate')),
                    unit: formData.get('unit')?.toUpperCase() || 'KG',
                    image: imageUrl,
                    available: formData.get('available') === 'on',
                    inStock: formData.get('available') === 'on', // Keep for backward compatibility
                    Fish_description: formData.get('Fish_description') || '',
                    Other_info: formData.get('Other_info') || '',
                    description: formData.get('Fish_description') || '' // Keep for backward compatibility
                  };
                  handleEditFish(updatedFish);
                }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fish Name</label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={editingFish.name}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        name="category"
                        defaultValue={editingFish.category}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      >
                        <option value="Seawater">Seawater</option>
                        <option value="Freshwater">Freshwater</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rate (₹)</label>
                      <input
                        type="number"
                        name="rate"
                        defaultValue={editingFish.rate}
                        required
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                      <select
                        name="unit"
                        defaultValue={editingFish.unit?.toUpperCase() || 'KG'}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      >
                        <option value="KG">KG</option>
                        <option value="PER KG">PER KG</option>
                        <option value="PIECE">PIECE</option>
                      </select>
                    </div>
                  </div>
                  <input type="hidden" name="image" defaultValue={editingFish.image || ''} />
                  <FishImageUpload
                    id="edit-fish-image"
                    label="Fish Image"
                    value={editingFish.image || ''}
                    onChange={(imageUrl) => {
                      // Update hidden input for form submission
                      const form = document.querySelector('form');
                      if (form) {
                        const hiddenInput = form.querySelector('input[name="image"]');
                        if (hiddenInput) {
                          hiddenInput.value = imageUrl;
                        }
                      }
                    }}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fish Description</label>
                    <textarea
                      name="Fish_description"
                      defaultValue={editingFish.Fish_description || editingFish.description || ''}
                      rows={3}
                      placeholder="Fish benefits, nutritional info, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Other Info</label>
                    <textarea
                      name="Other_info"
                      defaultValue={editingFish.Other_info || ''}
                      rows={3}
                      placeholder="Additional information, storage tips, cooking suggestions, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="available"
                      defaultChecked={editingFish.available !== undefined ? editingFish.available : (editingFish.inStock !== undefined ? editingFish.inStock : true)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">Available</label>
                  </div>
                  <div className="flex space-x-4">
                    <button 
                      type="submit" 
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loadingFishId === editingFish.id}
                    >
                      {loadingFishId === editingFish.id ? 'Updating...' : 'Update Fish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFish(null)}
                      className="btn-secondary"
                      disabled={loadingFishId === editingFish.id}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={filteredFishes.length > 0 && filteredFishes.every(fish => selectedFish.includes(fish.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = filteredFishes.map(f => f.id);
                              setSelectedFish([...new Set([...selectedFish, ...allIds])]);
                            } else {
                              const allIds = filteredFishes.map(f => f.id);
                              setSelectedFish(selectedFish.filter(id => !allIds.includes(id)));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fish
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Available
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredFishes.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                          No fish available
                        </td>
                      </tr>
                    ) : (
                      filteredFishes.map((fish) => {
                        return (
                      <tr 
                        key={fish.id} 
                        className={`hover:bg-gray-50 ${
                          selectedFish.includes(fish.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedFish.includes(fish.id)}
                            onChange={() => handleSelectFish(fish.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={getFishImageUrl(fish.image)}
                              alt={fish.name}
                              className="h-10 w-10 rounded-full object-cover"
                              onError={handleImageError}
                            />
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {fish.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {fish.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{fish.rate} / {fish.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (fish.available !== undefined ? fish.available : fish.inStock)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {(fish.available !== undefined ? fish.available : fish.inStock) ? 'Available' : 'Out of Stock'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setEditingFish(fish)}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loadingFishId === fish.id}
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to remove the image for this fish?')) {
                                setLoadingFishId(fish.id);
                                try {
                                  // Update fish image directly in Firestore
                                  const { updateFish } = await import('../services/firestoreService');
                                  await updateFish(fish.id, { image: '/images/fish/placeholder.jpg' });
                                  
                                  // Refresh fish list from Firestore
                                  await refreshFishData();
                                } catch (error) {
                                  console.error('Error removing image:', error);
                                  alert('Failed to remove image. Please try again.');
                                } finally {
                                  setLoadingFishId(null);
                                }
                              }
                            }}
                            className="text-orange-600 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loadingFishId === fish.id}
                          >
                            {loadingFishId === fish.id ? 'Removing...' : 'Remove Image'}
                          </button>
                          <button
                            onClick={() => handleDeleteFish(fish.id)}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loadingFishId === fish.id}
                          >
                            {loadingFishId === fish.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          );
        })()}

        {activeTab === 'orders' && (
          <AdminOrders shopInfo={fishData?.shopInfo} />
        )}

        {activeTab === 'stock' && (
          <DailyStockManager 
            fishData={fishData} 
          />
        )}

        {activeTab === 'bulkRates' && (
          <div className="space-y-6">
            <BulkRateUpdateForm fishData={fishData} refreshFishData={refreshFishData} />
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Rate History</h2>
            <div className="space-y-4">
              {fishData.fishes.map((fish) => (
                <div key={fish.id} className="card p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{fish.name}</h3>
                    <span className="text-2xl font-bold text-blue-600">₹{fish.rate}</span>
                  </div>
                  
                  {fish.rateHistory && fish.rateHistory.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Rate Changes:</h4>
                      <div className="space-y-1">
                        {fish.rateHistory.slice(0, 5).map((entry, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">
                              {new Date(entry.date).toLocaleDateString('en-IN')} at {new Date(entry.date).toLocaleTimeString('en-IN')}
                            </span>
                            <span className="font-medium">₹{entry.rate}</span>
                          </div>
                        ))}
                        {fish.rateHistory.length > 5 && (
                          <p className="text-xs text-gray-500">... and {fish.rateHistory.length - 5} more changes</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No rate history available</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Customer Reviews Management</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <span className="text-blue-600">ℹ️</span>
                <p className="text-blue-800 text-sm">
                  <strong>Admin Mode:</strong> You can delete inappropriate reviews by clicking the delete button (🗑️) next to each review.
                </p>
              </div>
            </div>
            <Reviews 
              isAdmin={true} 
              reviews={fishData.reviews || []} 
              onUpdateReviews={async (updatedReviews) => {
                try {
                  // Update reviews directly in Firestore
                  const { updateReviews } = await import('../services/firestoreService');
                  await updateReviews(updatedReviews);
                  
                  // Refresh fish data from Firestore
                  await refreshFishData();
                } catch (error) {
                  console.error('Error updating reviews:', error);
                  alert('Failed to update reviews. Please try again.');
                }
              }} 
            />
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Shop Settings</h2>
            <div className="card p-6">
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const formData = new FormData(e.target);
                  
                  // Handle owner photo file upload to Cloudinary
                  const ownerPhotoFile = formData.get('ownerPhotoFile');
                  let ownerPhotoUrl = formData.get('ownerPhoto') || '';
                  
                  // If a file was uploaded, upload to Cloudinary
                  if (ownerPhotoFile && ownerPhotoFile instanceof File && ownerPhotoFile.size > 0) {
                    try {
                      ownerPhotoUrl = await uploadOwnerPhoto(ownerPhotoFile);
                      console.log('✅ Owner photo uploaded to Cloudinary:', ownerPhotoUrl);
                    } catch (uploadError) {
                      console.error('Error uploading owner photo:', uploadError);
                      alert('Failed to upload owner photo. Please try again.');
                      return;
                    }
                  }
                  
                  // Build payload dynamically from form data - no hardcoded field names
                  const payload = Object.fromEntries(formData.entries());
                  
                  // Remove file input from payload (we already handled it)
                  delete payload.ownerPhotoFile;
                  
                  // Update ownerPhoto with Cloudinary URL if uploaded
                  if (ownerPhotoUrl) {
                    payload.ownerPhoto = ownerPhotoUrl;
                  }
                  
                  // Remove empty strings
                  Object.keys(payload).forEach(key => {
                    if (payload[key] === '') {
                      delete payload[key];
                    }
                  });
                  
                  // Save to Firestore using dynamic mapping
                  await saveShopSetting(payload);
                  
                  // Refresh fish data from Firestore
                  await refreshFishData();
                  alert('Shop settings updated successfully!');
                } catch (error) {
                  console.error('Error updating shop settings:', error);
                  alert('Failed to update shop settings. Please try again.');
                }
              }} className="space-y-6">
                {/* Shop Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shop Logo</label>
                  <div className="space-y-3">
                    <input
                      type="url"
                      name="shopLogo"
                      defaultValue={fishData.shopInfo.shopLogo || ''}
                      placeholder="https://example.com/shop-logo.png"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                    <div className="text-center">
                      <span className="text-sm text-gray-500">OR</span>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            // Check file size (max 5MB)
                            if (file.size > 5 * 1024 * 1024) {
                              alert('File size too large. Please select an image smaller than 5MB.');
                              return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const preview = document.getElementById('shop-logo-preview');
                              const urlInput = document.querySelector('input[name="shopLogo"]');
                              
                              if (preview) {
                                preview.src = event.target.result;
                                preview.style.display = 'block';
                              }
                              
                              // Auto-fill the URL input with the data URL (for preview)
                              if (urlInput) {
                                urlInput.value = event.target.result;
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="shop-logo-upload"
                      />
                      <label
                        htmlFor="shop-logo-upload"
                        className="cursor-pointer flex flex-col items-center space-y-2"
                      >
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">🏪</span>
                        </div>
                        <span className="text-sm text-gray-600">Upload shop logo</span>
                        <span className="text-xs text-gray-500">JPG, PNG, WebP (max 5MB)</span>
                      </label>
                      <img
                        id="shop-logo-preview"
                        src={fishData.shopInfo.shopLogo || ''}
                        className={`mt-3 w-24 h-24 object-cover rounded-lg mx-auto ${fishData.shopInfo.shopLogo ? 'block' : 'hidden'}`}
                        alt="Shop Logo Preview"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={fishData.shopInfo.name}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
                    <input
                      type="text"
                      name="owner"
                      defaultValue={fishData.shopInfo.owner}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Owner Photo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner Photo</label>
                  <div className="space-y-3">
                    <input
                      type="url"
                      name="ownerPhoto"
                      defaultValue={fishData.shopInfo.ownerPhoto || ''}
                      placeholder="https://example.com/owner-photo.jpg"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                    <div className="text-center">
                      <span className="text-sm text-gray-500">OR</span>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                      <input
                        type="file"
                        name="ownerPhotoFile"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            // Check file size (max 5MB)
                            if (file.size > 5 * 1024 * 1024) {
                              alert('File size too large. Please select an image smaller than 5MB.');
                              return;
                            }
                            
                            try {
                              // Upload to Cloudinary immediately for preview
                              const imageUrl = await uploadOwnerPhoto(file);
                              const preview = document.getElementById('owner-photo-preview');
                              const urlInput = document.querySelector('input[name="ownerPhoto"]');
                              
                              if (preview) {
                                preview.src = imageUrl;
                                preview.style.display = 'block';
                              }
                              
                              // Update URL input with Cloudinary URL
                              if (urlInput) {
                                urlInput.value = imageUrl;
                              }
                            } catch (uploadError) {
                              console.error('Error uploading owner photo:', uploadError);
                              alert('Failed to upload photo. Please try again.');
                            }
                          }
                        }}
                        className="hidden"
                        id="owner-photo-upload"
                      />
                      <label
                        htmlFor="owner-photo-upload"
                        className="cursor-pointer flex flex-col items-center space-y-2"
                      >
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">👤</span>
                        </div>
                        <span className="text-sm text-gray-600">Upload owner photo to Cloudinary</span>
                        <span className="text-xs text-gray-500">JPG, PNG, WebP (max 5MB)</span>
                      </label>
                      <img
                        id="owner-photo-preview"
                        src={fishData.shopInfo.ownerPhoto || ''}
                        className={`mt-3 w-24 h-24 object-cover rounded-full mx-auto ${fishData.shopInfo.ownerPhoto ? 'block' : 'hidden'}`}
                        alt="Owner Photo Preview"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={fishData.shopInfo.phone}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Number</label>
                    <input
                      type="tel"
                      name="whatsapp"
                      defaultValue={fishData.shopInfo.whatsapp || fishData.shopInfo.phone}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      placeholder="e.g., 919096205136"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={fishData.shopInfo.email}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                    <input
                      type="text"
                      name="upiId"
                      defaultValue={fishData.shopInfo.upiId}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    name="address"
                    defaultValue={fishData.shopInfo.address}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Working Hours</label>
                  <input
                    type="text"
                    name="workingHours"
                    defaultValue={fishData.shopInfo.workingHours}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'promotions' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Promotions</h2>

            {/* Internal Promotions navigation */}
            <div className="flex flex-wrap gap-2 bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
              {[
                { id: 'basket', label: 'Basket Discount' },
                { id: 'banner', label: 'Promotion Banner' },
                { id: 'offers', label: 'Offers & Promotions' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPromoSection(item.id);
                    // Smooth-scroll to section after it becomes visible
                    setTimeout(() => {
                      document
                        .getElementById(`promo-section-${item.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    promoSection === item.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            
            {/* 1. Basket Discount — existing form unchanged */}
            {promoSection === 'basket' && (
            <div id="promo-section-basket" className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Build Your Basket Discount Settings</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // Build payload dynamically from form data - no hardcoded field names
                  const formData = new FormData(e.target);
                  const payload = Object.fromEntries(formData.entries());
                  
                  // Convert checkbox to boolean
                  if (payload.discountEnabled === 'on') {
                    payload.isEnabled = true;
                    delete payload.discountEnabled;
                  } else {
                    payload.isEnabled = false;
                    delete payload.discountEnabled;
                  }
                  
                  // Convert numeric fields
                  if (payload.discountPercentage) {
                    payload.percentage = parseFloat(payload.discountPercentage);
                    delete payload.discountPercentage;
                  }
                  if (payload.minimumAmount) {
                    payload.minimumAmount = parseFloat(payload.minimumAmount);
                  }
                  if (payload.discountDescription) {
                    payload.description = payload.discountDescription;
                    delete payload.discountDescription;
                  }
                  
                  // Save to Firestore using dynamic mapping
                  await saveDiscountSettings(payload);
                  
                  // Refresh fish data from Firestore
                  await refreshFishData();
                  alert('Discount settings updated successfully!');
                } catch (error) {
                  console.error('Error updating discount settings:', error);
                  alert('Failed to update discount settings. Please try again.');
                }
              }} className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="discountEnabled"
                    defaultChecked={fishData.discountSettings?.isEnabled ?? true}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">Enable Build Your Basket Discount</label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Discount Percentage (%)</label>
                    <input
                      type="number"
                      name="discountPercentage"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={fishData.discountSettings?.percentage ?? 5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Amount (₹)</label>
                    <input
                      type="number"
                      name="minimumAmount"
                      min="0"
                      step="1"
                      defaultValue={fishData.discountSettings?.minimumAmount ?? 1000}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Description</label>
                  <input
                    type="text"
                    name="discountDescription"
                    defaultValue={fishData.discountSettings?.description ?? "off ₹1000+"}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="e.g., off ₹1000+"
                    required
                  />
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Discount Preview:</h4>
                  <div className="text-green-700">
                    {fishData.discountSettings?.isEnabled !== false ? 
                      `Discount (${fishData.discountSettings?.percentage ?? 5}% ${fishData.discountSettings?.description ?? "off ₹1000+"}): -₹0.00` : 
                      'Discount disabled'
                    }
                  </div>
                </div>
                
                <button type="submit" className="btn-primary">
                  Update Discount Settings
                </button>
              </form>
            </div>
            )}

            {/* 2. Promotion Banner — existing form unchanged */}
            {promoSection === 'banner' && (
            <div id="promo-section-banner" className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Promotion Banner</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // Build payload dynamically from form data - no hardcoded field names
                  const formData = new FormData(e.target);
                  const payload = Object.fromEntries(formData.entries());
                  
                  // Handle discountedFish validation
                  const discountedFishText = payload.discountedFish || '';
                  
                  // Import validation function
                  const { validateAndCorrectFishNames } = await import('../utils/fishNameMatching');
                  const validation = validateAndCorrectFishNames(discountedFishText, fishData.fishes);
                  
                  if (validation.hasErrors) {
                    alert('Please fix the fish name errors before saving:\n' + validation.warnings.join('\n'));
                    return;
                  }
                  
                  // Update payload with validated fish names
                  payload.discountedFish = validation.correctedNames;
                  
                  // Convert checkbox to boolean
                  if (payload.isActive === 'on') {
                    payload.isActive = true;
                  } else {
                    payload.isActive = false;
                  }
                  
                  // Convert numeric fields
                  if (payload.discountPercentage) {
                    payload.discountPercentage = parseInt(payload.discountPercentage) || 0;
                  }
                  
                  // Convert date field
                  if (payload.expiresOn) {
                    payload.expiresOn = new Date(payload.expiresOn).toISOString();
                  }
                  
                  // Save to Firestore using dynamic mapping
                  await savePromotionBanner(payload);
                  
                  // Refresh fish data from Firestore
                  await refreshFishData();
                  
                  if (validation.warnings.length > 0) {
                    alert('Promotion updated successfully!\n\nNote: ' + validation.warnings.join('\n'));
                  } else {
                    alert('Promotion updated successfully!');
                  }
                } catch (error) {
                  console.error('Error updating promotions:', error);
                  alert('Failed to update promotions. Please try again.');
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Promotion Text</label>
                  <input
                    type="text"
                    name="text"
                    defaultValue={fishData.promotions.text}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="e.g., 🎉 Weekend Offer: 5% Off on Surmai!"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Discount Percentage (%)</label>
                    <input
                      type="number"
                      name="discountPercentage"
                      min="0"
                      max="100"
                      step="1"
                      defaultValue={fishData.promotions.discountPercentage || 0}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      placeholder="e.g., 15"
                    />
                  </div>
                  
                  <div>
                    <SmartFishNameInput
                      value={fishData.promotions.discountedFish ? fishData.promotions.discountedFish.join(', ') : ''}
                      onChange={(value) => {
                        // Update the hidden input for form submission
                        const hiddenInput = document.querySelector('input[name="discountedFish"]');
                        if (hiddenInput) {
                          hiddenInput.value = value;
                        }
                      }}
                      allFish={fishData.fishes}
                      placeholder="e.g., Surmai (King Fish), Pomfret (White)"
                    />
                    {/* Hidden input for form submission */}
                    <input
                      type="hidden"
                      name="discountedFish"
                      defaultValue={fishData.promotions.discountedFish ? fishData.promotions.discountedFish.join(', ') : ''}
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={fishData.promotions.isActive}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Active Promotion</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expires On</label>
                  <input
                    type="datetime-local"
                    name="expiresOn"
                    defaultValue={new Date(fishData.promotions.expiresOn).toISOString().slice(0, 16)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    required
                  />
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Current Promotion Preview:</h4>
                  <div className="bg-red-500 text-white p-3 rounded-lg">
                    {fishData.promotions.isActive ? fishData.promotions.text : 'No active promotion'}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Expires: {new Date(fishData.promotions.expiresOn).toLocaleString('en-IN')}
                  </p>
                  
                  {/* Validation Warnings */}
                  {fishData.promotions.isActive && (
                    <div className="mt-3 space-y-2">
                      {fishData.promotions.text.includes('15%') && fishData.promotions.discountPercentage !== 15 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                          <p className="text-xs text-yellow-700">
                            ⚠️ Promotion text mentions "15%" but discount is set to {fishData.promotions.discountPercentage}%
                          </p>
                        </div>
                      )}
                      
                      {fishData.promotions.text.includes('Surmai') && !fishData.promotions.discountedFish?.includes('Surmai (King Fish)') && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs text-red-700">
                            ❌ Promotion text mentions "Surmai" but it's not in discounted fish list
                          </p>
                        </div>
                      )}
                      
                      {fishData.promotions.text.includes('Pomfret') && !fishData.promotions.discountedFish?.includes('Pomfret (White)') && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs text-red-700">
                            ❌ Promotion text mentions "Pomfret" but it's not in discounted fish list
                          </p>
                        </div>
                      )}
                      
                      {fishData.promotions.discountedFish?.length === 0 && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs text-red-700">
                            ❌ No fish selected for discount
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button type="submit" className="btn-primary flex-1">
                    Update Promotion
                  </button>
                  
                  {/* Quick Fix Button */}
                  <button 
                    type="button"
                    onClick={() => {
                      // Auto-fix common mismatches
                      const text = fishData.promotions.text;
                      let discountPercentage = fishData.promotions.discountPercentage;
                      let discountedFish = [...(fishData.promotions.discountedFish || [])];
                      
                      // Extract percentage from text
                      const percentageMatch = text.match(/(\d+)%/);
                      if (percentageMatch) {
                        discountPercentage = parseInt(percentageMatch[1]);
                      }
                      
                      // Add missing fish based on text
                      if (text.includes('Surmai') && !discountedFish.includes('Surmai (King Fish)')) {
                        discountedFish.push('Surmai (King Fish)');
                      }
                      if (text.includes('Pomfret') && !discountedFish.includes('Pomfret (White)')) {
                        discountedFish.push('Pomfret (White)');
                      }
                      
                      // Update the form fields
                      const form = document.querySelector('form');
                      if (form) {
                        form.querySelector('input[name="discountPercentage"]').value = discountPercentage;
                        form.querySelector('input[name="discountedFish"]').value = discountedFish.join(', ');
                      }
                      
                      alert(`Auto-fixed:\n- Discount: ${discountPercentage}%\n- Fish: ${discountedFish.join(', ')}`);
                    }}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    🔧 Auto-Fix
                  </button>
                </div>
              </form>
            </div>
            )}

            {/* 3. Offers & Promotions — existing Firestore offers module */}
            {promoSection === 'offers' && (
              <div id="promo-section-offers">
                <AdminOffers fishData={fishData} refreshFishData={refreshFishData} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Backup & Restore</h2>
            
            {/* Backup Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <div className="text-2xl font-bold text-blue-600">{fishData.fishes.length}</div>
                <div className="text-sm text-gray-600">Total Fish</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-bold text-red-500">{fishData.fishes.filter(f => (f.available !== undefined ? f.available : f.inStock)).length}</div>
                <div className="text-sm text-gray-600">Available</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-bold text-green-600">
                  {new Date(fishData.shopInfo.updatedOn).toLocaleDateString('en-IN')}
                </div>
                <div className="text-sm text-gray-600">Last Updated</div>
              </div>
            </div>

            {/* Export All Collections */}
            <div className="card p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">📦 Export All Collections</h3>
              <p className="text-gray-600 mb-4 text-sm">Download a complete backup of all Firestore collections (fishes, reviews, daily, rateHistory, shopSetting, promotions)</p>
              <button
                onClick={async () => {
                  try {
                    await downloadAllCollections();
                    await refreshFishData();
                  } catch (error) {
                    console.error('Error exporting all collections:', error);
                  }
                }}
                className="btn-primary w-full"
              >
                📥 Export All Collections (JSON)
              </button>
            </div>

            {/* Import All Collections */}
            <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">📤 Import All Collections</h3>
              <p className="text-gray-600 mb-4 text-sm">Restore all collections from a complete backup file</p>
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    try {
                      await uploadAllCollections(file, { merge: false, deleteExisting: false });
                      await refreshFishData();
                      window.location.reload();
                    } catch (error) {
                      console.error('Error importing all collections:', error);
                    }
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-2">
                ⚠️ This will import data to all collections. Make sure to backup first!
              </div>
            </div>

            {/* Collection-Specific Export/Import */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Collection-Specific Backup & Restore</h3>
              <p className="text-gray-600 mb-4 text-sm">Export or import individual collections</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Fishes Collection */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-gray-800 mb-2">🐟 Fishes</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => downloadCollectionData('fishes', 'json')}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      📥 Export JSON
                    </button>
                    <button
                      onClick={() => downloadCollectionData('fishes', 'csv')}
                      className="w-full px-3 py-2 bg-blue-400 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors"
                    >
                      📊 Export CSV
                    </button>
                    <label className="cursor-pointer block w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors text-center">
                      📤 Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              await uploadCollectionData('fishes', file, { merge: false, deleteExisting: false });
                              await refreshFishData();
                            } catch (error) {
                              console.error('Error importing fishes:', error);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Reviews Collection */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-gray-800 mb-2">⭐ Reviews</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => downloadCollectionData('reviews', 'json')}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      📥 Export JSON
                    </button>
                    <button
                      onClick={() => downloadCollectionData('reviews', 'csv')}
                      className="w-full px-3 py-2 bg-blue-400 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors"
                    >
                      📊 Export CSV
                    </button>
                    <label className="cursor-pointer block w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors text-center">
                      📤 Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              await uploadCollectionData('reviews', file, { merge: false, deleteExisting: false });
                              await refreshFishData();
                            } catch (error) {
                              console.error('Error importing reviews:', error);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Daily Stock Collection */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-gray-800 mb-2">📅 Daily Stock</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => downloadCollectionData('daily', 'json')}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      📥 Export JSON
                    </button>
                    <button
                      onClick={() => downloadCollectionData('daily', 'csv')}
                      className="w-full px-3 py-2 bg-blue-400 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors"
                    >
                      📊 Export CSV
                    </button>
                    <label className="cursor-pointer block w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors text-center">
                      📤 Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              await uploadCollectionData('daily', file, { merge: false, deleteExisting: false });
                              await refreshFishData();
                            } catch (error) {
                              console.error('Error importing daily stock:', error);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Rate History Collection */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-gray-800 mb-2">📈 Rate History</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => downloadCollectionData('rateHistory', 'json')}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      📥 Export JSON
                    </button>
                    <button
                      onClick={() => downloadCollectionData('rateHistory', 'csv')}
                      className="w-full px-3 py-2 bg-blue-400 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors"
                    >
                      📊 Export CSV
                    </button>
                    <label className="cursor-pointer block w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors text-center">
                      📤 Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              await uploadCollectionData('rateHistory', file, { merge: false, deleteExisting: false });
                              await refreshFishData();
                            } catch (error) {
                              console.error('Error importing rate history:', error);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Shop Setting */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-gray-800 mb-2">🏪 Shop Settings</h4>
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        try {
                          const { loadShopSettingFromFirestore } = await import('../services/firestoreService');
                          const shopSetting = await loadShopSettingFromFirestore();
                          if (shopSetting) {
                            const data = { shopSetting_main: shopSetting };
                            const jsonContent = JSON.stringify(data, null, 2);
                            const blob = new Blob([jsonContent], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `shopSetting_backup_${new Date().toISOString().split('T')[0]}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                            alert('✅ Shop settings exported successfully!');
                          } else {
                            alert('⚠️ No shop settings found to export.');
                          }
                        } catch (error) {
                          console.error('Error exporting shop settings:', error);
                          alert('❌ Error exporting shop settings.');
                        }
                      }}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      📥 Export JSON
                    </button>
                    <label className="cursor-pointer block w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors text-center">
                      📤 Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const fileText = await file.text();
                              const data = JSON.parse(fileText);
                              const { saveShopSetting } = await import('../services/firestoreService');
                              if (data.shopSetting_main) {
                                await saveShopSetting(data.shopSetting_main);
                                await refreshFishData();
                                alert('✅ Shop settings imported successfully!');
                              } else {
                                alert('⚠️ Invalid file format. Expected shopSetting_main field.');
                              }
                            } catch (error) {
                              console.error('Error importing shop settings:', error);
                              alert('❌ Error importing shop settings.');
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Promotions & Discounts */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <h4 className="font-semibold text-gray-800 mb-2">🎉 Promotions</h4>
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        try {
                          const { loadPromotionBannerFromFirestore, loadDiscountSettingsFromFirestore } = await import('../services/firestoreService');
                          const banner = await loadPromotionBannerFromFirestore();
                          const discount = await loadDiscountSettingsFromFirestore();
                          const data = {
                            promotionAndDiscounts_banner: banner,
                            promotionAndDiscounts_discount: discount
                          };
                          const jsonContent = JSON.stringify(data, null, 2);
                          const blob = new Blob([jsonContent], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `promotions_backup_${new Date().toISOString().split('T')[0]}.json`;
                          link.click();
                          URL.revokeObjectURL(url);
                          alert('✅ Promotions exported successfully!');
                        } catch (error) {
                          console.error('Error exporting promotions:', error);
                          alert('❌ Error exporting promotions.');
                        }
                      }}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                    >
                      📥 Export JSON
                    </button>
                    <label className="cursor-pointer block w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors text-center">
                      📤 Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const fileText = await file.text();
                              const data = JSON.parse(fileText);
                              const { savePromotionBanner, saveDiscountSettings } = await import('../services/firestoreService');
                              if (data.promotionAndDiscounts_banner) {
                                await savePromotionBanner(data.promotionAndDiscounts_banner);
                              }
                              if (data.promotionAndDiscounts_discount) {
                                await saveDiscountSettings(data.promotionAndDiscounts_discount);
                              }
                              await refreshFishData();
                              alert('✅ Promotions imported successfully!');
                            } catch (error) {
                              console.error('Error importing promotions:', error);
                              alert('❌ Error importing promotions.');
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Legacy Export (for backward compatibility) */}
            <div className="card p-6 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📦 Legacy Export (All Fish Data)</h3>
              <p className="text-gray-600 mb-4 text-sm">Export all fish data in the legacy format (includes fishes, reviews, shopInfo, promotions, discountSettings)</p>
              <div className="space-y-3">
                <button
                  onClick={handleExportData}
                  className="btn-primary w-full"
                >
                  📥 Export All Fish Data (JSON)
                </button>
                <button
                  onClick={() => {
                    const csvData = [
                      ['Fish Name', 'Category', 'Rate', 'Unit', 'Available', 'Fish Description', 'Other Info'],
                      ...fishData.fishes.map(fish => [
                        fish.name,
                        fish.category,
                        fish.rate,
                        fish.unit,
                        (fish.available !== undefined ? fish.available : fish.inStock) ? 'Yes' : 'No',
                        fish.Fish_description || fish.description || '',
                        fish.Other_info || ''
                      ])
                    ].map(row => row.join(',')).join('\n');
                    
                    const blob = new Blob([csvData], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `fish_data_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-secondary w-full"
                >
                  📊 Export Fishes CSV
                </button>
              </div>
            </div>

            {/* Legacy Import */}
            <div className="card p-6 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📤 Legacy Import</h3>
              <p className="text-gray-600 mb-4 text-sm">Import data from legacy backup format</p>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-2">
                ⚠️ Importing will replace current data. Make sure to backup first!
              </div>
            </div>

            {/* Bulk Import Fish */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📦 Bulk Import Fish</h3>
              <p className="text-gray-600 mb-4">Import all fish from the pre-configured list to Firestore</p>
              <button
                onClick={async () => {
                  if (window.confirm('This will import all fish from the bulk import list to Firestore. Continue?')) {
                    try {
                      const { bulkImportFish, fishImportData } = await import('../utils/bulkImportFish');
                      const result = await bulkImportFish(fishImportData);
                      alert(`✅ Import Complete!\n\nImported: ${result.imported}\nSkipped: ${result.skipped}\nErrors: ${result.errors}\n\nPlease refresh the page to see the new fish.`);
                      window.location.reload();
                    } catch (error) {
                      console.error('Error importing fish:', error);
                      alert('❌ Error importing fish. Check console for details.');
                    }
                  }
                }}
                className="btn-primary w-full"
              >
                📦 Bulk Import Fish to Firestore
              </button>
              <p className="text-xs text-gray-500 mt-2">
                This will add all fish from the import list. Existing fish with the same name will be skipped.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Firestore Diagnostics</h2>
              <p className="text-gray-600 mb-6">
                Use this tool to diagnose Firestore connection issues and verify your configuration.
              </p>
              <FirestoreDiagnostics />
            </div>
          </div>
        )}
      </div>

      {/* Bulk Operations Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Bulk Operations</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedFish.length} fish selected
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setBulkAction('delete');
                  handleBulkAction();
                }}
                className="w-full text-left p-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
              >
                🗑️ Delete Selected Fish
              </button>
              
              <button
                onClick={() => {
                  setBulkAction('toggle_stock');
                  handleBulkAction();
                }}
                className="w-full text-left p-3 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                📦 Toggle Stock Status
              </button>
              
              <button
                onClick={() => {
                  setBulkAction('update_category');
                  handleBulkAction();
                }}
                className="w-full text-left p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                🏷️ Update Category
              </button>
              
              <button
                onClick={() => {
                  setBulkAction('update_price');
                  handleBulkAction();
                }}
                className="w-full text-left p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                💰 Update Prices
              </button>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

