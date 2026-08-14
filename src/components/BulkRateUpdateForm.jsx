import { useState, useEffect, useMemo } from 'react';
import { bulkUpdateFishRates } from '../services/firestoreService';

const BulkRateUpdateForm = ({ fishData, refreshFishData }) => {
  // State for form data - each fish has rate and available
  const [fishUpdates, setFishUpdates] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [originalData, setOriginalData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data from fishData
  useEffect(() => {
    const initialUpdates = {};
    const initialOriginal = {};
    
    fishData.fishes.forEach(fish => {
      const fishId = String(fish.id);
      initialUpdates[fishId] = {
        fishId: fishId,
        fishName: fish.name,
        rate: fish.rate || 0,
        available: fish.available !== undefined ? fish.available : (fish.inStock !== undefined ? fish.inStock : true)
      };
      initialOriginal[fishId] = {
        rate: fish.rate || 0,
        available: fish.available !== undefined ? fish.available : (fish.inStock !== undefined ? fish.inStock : true)
      };
    });
    
    setFishUpdates(initialUpdates);
    setOriginalData(initialOriginal);
    setHasChanges(false);
  }, [fishData.fishes]);

  // Check if there are changes
  useEffect(() => {
    const changed = Object.keys(fishUpdates).some(fishId => {
      const update = fishUpdates[fishId];
      const original = originalData[fishId];
      if (!original) return false;
      return update.rate !== original.rate || update.available !== original.available;
    });
    setHasChanges(changed);
  }, [fishUpdates, originalData]);

  // Handle rate change
  const handleRateChange = (fishId, newRate) => {
    const rateValue = parseFloat(newRate);
    if (isNaN(rateValue) || rateValue < 0) {
      alert('Rate must be a positive number');
      return;
    }
    
    setFishUpdates(prev => ({
      ...prev,
      [fishId]: {
        ...prev[fishId],
        rate: rateValue
      }
    }));
  };

  // Handle availability change
  const handleAvailabilityChange = (fishId, newAvailable) => {
    setFishUpdates(prev => ({
      ...prev,
      [fishId]: {
        ...prev[fishId],
        available: !!newAvailable
      }
    }));
  };

  // Undo changes - reset to original data
  const handleUndoChanges = () => {
    const resetUpdates = {};
    Object.keys(fishUpdates).forEach(fishId => {
      resetUpdates[fishId] = {
        ...fishUpdates[fishId],
        rate: originalData[fishId]?.rate || 0,
        available: originalData[fishId]?.available !== undefined ? originalData[fishId].available : true
      };
    });
    setFishUpdates(resetUpdates);
    setHasChanges(false);
  };

  // Update all rates - atomic batch write
  const handleUpdateAllRates = async () => {
    // Validation
    const updates = [];
    const errors = [];

    Object.values(fishUpdates).forEach(update => {
      if (!update.fishName || update.fishName.trim() === '') {
        errors.push(`Fish name is required for fish ID: ${update.fishId}`);
        return;
      }
      if (update.rate === undefined || isNaN(update.rate) || update.rate < 0) {
        errors.push(`Invalid rate for ${update.fishName}: ${update.rate}`);
        return;
      }
      if (update.available === undefined) {
        errors.push(`Availability must be selected for ${update.fishName}`);
        return;
      }

      // Only include fish that have changed
      const original = originalData[update.fishId];
      if (original && (update.rate !== original.rate || update.available !== original.available)) {
        updates.push({
          fishId: update.fishId,
          rate: update.rate,
          available: update.available
        });
      }
    });

    if (errors.length > 0) {
      alert('Validation errors:\n' + errors.join('\n'));
      return;
    }

    if (updates.length === 0) {
      alert('No changes to update. All values are the same as current data.');
      return;
    }

    // Confirm update
    if (!window.confirm(`Update rates and availability for ${updates.length} fish?`)) {
      return;
    }

    setIsUpdating(true);

    try {
      // Perform atomic batch update
      const result = await bulkUpdateFishRates(updates, 'admin', 3);

      if (result.success) {
        alert(`✅ All fish rates successfully updated!\n\nUpdated: ${result.updated} fish\nFish: ${result.fishNames.join(', ')}`);
        
        // Refresh data
        await refreshFishData();
        
        // Reset form to new values
        const newOriginal = {};
        Object.keys(fishUpdates).forEach(fishId => {
          const update = fishUpdates[fishId];
          newOriginal[fishId] = {
            rate: update.rate,
            available: update.available
          };
        });
        setOriginalData(newOriginal);
        setHasChanges(false);
      } else {
        alert(`❌ Update failed — all changes reverted.\n\nError: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error updating fish rates:', error);
      alert(`❌ Update failed — all changes reverted.\n\nError: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Sort fish by name
  const sortedFishes = useMemo(() => {
    return Object.values(fishUpdates).sort((a, b) => 
      a.fishName.localeCompare(b.fishName)
    );
  }, [fishUpdates]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Fish Rate & Availability Update</h2>
          <p className="text-gray-600 mt-1">Update multiple fish rates and availability in one action</p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <button
              onClick={handleUndoChanges}
              disabled={isUpdating}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↶ Undo Changes
            </button>
          )}
          <button
            onClick={handleUpdateAllRates}
            disabled={isUpdating || !hasChanges}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUpdating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <span>✅</span>
                <span>Update All Rates</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Atomic Updates:</strong> All changes are saved together using Firestore batch writes. 
          If any update fails, all changes are automatically reverted.
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-50 text-gray-700 text-sm font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left w-1/2">
                  FISH NAME
                </th>
                <th className="px-4 py-3 text-center w-1/4">
                  RATE (₹)
                </th>
                <th className="px-4 py-3 text-center w-1/4">
                  AVAILABLE
                </th>
              </tr>
            </thead>
            <tbody className="bg-white text-gray-800">
              {sortedFishes.map((fish) => {
                const original = originalData[fish.fishId];
                const hasChanged = original && (
                  fish.rate !== original.rate || 
                  fish.available !== original.available
                );

                return (
                  <tr
                    key={fish.fishId}
                    className={`border-b hover:bg-gray-50 ${hasChanged ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {fish.fishName}
                      </div>
                      {hasChanged && (
                        <div className="text-xs text-yellow-600 mt-1">
                          ✏️ Modified
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fish.rate}
                        onChange={(e) => handleRateChange(fish.fishId, e.target.value)}
                        disabled={isUpdating}
                        className={`w-24 md:w-32 px-2 py-1 border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          hasChanged ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                      {original && fish.rate !== original.rate && (
                        <div className="text-xs text-gray-500 mt-1">
                          Was: ₹{original.rate}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={fish.available}
                        onChange={(e) => handleAvailabilityChange(fish.fishId, e.target.checked)}
                        disabled={isUpdating}
                        className="w-5 h-5 accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {original && fish.available !== original.available && (
                        <div className="text-xs text-gray-500 mt-1">
                          Was: {original.available ? 'Available' : 'Out of Stock'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {hasChanges && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            <strong>📊 Changes Summary:</strong> {Object.keys(fishUpdates).filter(fishId => {
              const update = fishUpdates[fishId];
              const original = originalData[fishId];
              return original && (update.rate !== original.rate || update.available !== original.available);
            }).length} fish will be updated when you click "Update All Rates"
          </p>
        </div>
      )}

      {/* Empty State */}
      {sortedFishes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🐟</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Fish Found</h3>
          <p className="text-gray-600">Add fish to the catalog to update rates</p>
        </div>
      )}
    </div>
  );
};

export default BulkRateUpdateForm;

