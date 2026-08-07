import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Calculator, Weight, DollarSign } from 'lucide-react';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';

const BasketEstimator = ({ fishData, onAddToCart }) => {
  const [basket, setBasket] = useState([]);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    // Calculate totals
    const weight = basket.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
    const price = basket.reduce((sum, item) => sum + (item.price * item.weight * item.quantity), 0);
    
    setTotalWeight(weight);
    setTotalPrice(price);
    
    // Calculate delivery fee (free over ₹500)
    setDeliveryFee(price > 500 ? 0 : 50);
    
    // Calculate discount based on admin settings
    const discountSettings = fishData.discountSettings || { isEnabled: true, percentage: 5, minimumAmount: 1000 };
    if (discountSettings.isEnabled && price >= discountSettings.minimumAmount) {
      setDiscount(price * (discountSettings.percentage / 100));
    } else {
      setDiscount(0);
    }
  }, [basket]);

  const addToBasket = (fish) => {
    const existingItem = basket.find(item => item.id === fish.id);
    if (existingItem) {
      setBasket(basket.map(item => 
        item.id === fish.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setBasket([...basket, {
        id: fish.id,
        name: fish.name,
        price: fish.rate,
        weight: 1, // Default 1 kg
        quantity: 1,
        image: fish.image,
        category: fish.category
      }]);
    }
  };

  const updateWeight = (id, weight) => {
    setBasket(basket.map(item => 
      item.id === id 
        ? { ...item, weight: Math.max(0.1, weight) }
        : item
    ));
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setBasket(basket.filter(item => item.id !== id));
    } else {
      setBasket(basket.map(item => 
        item.id === id 
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const removeFromBasket = (id) => {
    setBasket(basket.filter(item => item.id !== id));
  };

  const clearBasket = () => {
    setBasket([]);
  };

  const finalTotal = totalPrice + deliveryFee - discount;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Calculator className="h-6 w-6 text-blue-600" />
          <h3 className="text-2xl font-bold text-gray-900">Build Your Basket</h3>
        </div>
        <p className="text-gray-600">Add fish and weights to estimate your total before ordering</p>
      </div>

      {/* Fish Selection */}
      <div className="card p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-4">Select Fish</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fishData.fishes.filter(fish => fish.inStock).map((fish) => (
            <div key={fish.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-600 transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <img
                  src={getFishImageUrl(fish.image)}
                  alt={fish.name}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={handleImageError}
                />
                <div className="flex-1">
                  <h5 className="font-semibold text-gray-900">{fish.name}</h5>
                  <p className="text-sm text-gray-600">₹{fish.rate}/kg</p>
                </div>
              </div>
              <button
                onClick={() => addToBasket(fish)}
                className="w-full btn-primary text-sm"
              >
                Add to Basket
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Basket Contents */}
      {basket.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-900 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Your Basket ({basket.length} items)
            </h4>
            <button
              onClick={clearBasket}
              className="text-red-500 hover:text-red-700 text-sm flex items-center"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </button>
          </div>

          <div className="space-y-4">
            {basket.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <img
                  src={getFishImageUrl(item.image)}
                  alt={item.name}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={handleImageError}
                />
                
                <div className="flex-1">
                  <h5 className="font-semibold text-gray-900">{item.name}</h5>
                  <p className="text-sm text-gray-600">{item.category}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Weight:</label>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => updateWeight(item.id, item.weight - 0.1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={item.weight}
                      onChange={(e) => updateWeight(item.id, parseFloat(e.target.value) || 0.1)}
                      className="w-16 text-center border border-gray-300 rounded px-2 py-1"
                      min="0.1"
                      step="0.1"
                    />
                    <button
                      onClick={() => updateWeight(item.id, item.weight + 0.1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm text-gray-600">kg</span>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Qty:</label>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    ₹{(item.price * item.weight * item.quantity).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">
                    ₹{item.price}/kg × {item.weight}kg × {item.quantity}
                  </p>
                </div>

                <button
                  onClick={() => removeFromBasket(item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Summary */}
      {basket.length > 0 && (
        <div className="card p-6 bg-gradient-to-r from-green-50 to-blue-50">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Price Summary
          </h4>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Weight:</span>
              <span className="font-semibold">{totalWeight.toFixed(1)} kg</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Fish Total:</span>
              <span className="font-semibold">₹{totalPrice.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Fee:</span>
              <span className="font-semibold">
                {deliveryFee > 0 ? `₹${deliveryFee}` : 'FREE'}
              </span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({fishData.discountSettings?.percentage || 5}% {fishData.discountSettings?.description || "off ₹1000+"}):</span>
                <span className="font-semibold">-₹{discount.toFixed(2)}</span>
              </div>
            )}
            
            <hr className="border-gray-300" />
            
            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>Final Total:</span>
              <span>₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 flex space-x-4">
            <button
              onClick={() => {
                basket.forEach(item => {
                  // Create fish object with weight information preserved
                  const fishToAdd = {
                    id: item.id,
                    name: item.name,
                    rate: item.price, // Per-kg rate (this will be used for promotional pricing)
                    price: item.price * item.weight, // Total price for this weight
                    weight: item.weight, // Preserve weight
                    unit: 'kg', // Specify unit
                    image: item.image,
                    category: item.category,
                    inStock: true
                  };
                  
                  // Add to cart with quantity = 1 (since each basket item is one "order" with specific weight)
                  // The addToCart function will apply promotional pricing automatically
                  onAddToCart(fishToAdd, 1);
                });
                clearBasket();
              }}
              className="flex-1 btn-primary"
            >
              Add All to Cart
            </button>
            
            <button
              onClick={() => {
                // Generate WhatsApp message
                const message = `Hi! I'd like to order:
${basket.map(item => `${item.name} - ${item.weight}kg × ${item.quantity} = ₹${(item.price * item.weight * item.quantity).toFixed(2)}`).join('\n')}

Total: ₹${finalTotal.toFixed(2)}
Please confirm availability and delivery.`;
                
                const whatsappUrl = `https://wa.me/919096205136?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
              }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Order via WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {basket.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-600 mb-2">Your basket is empty</h4>
          <p className="text-gray-500">Add some fish above to start building your order</p>
        </div>
      )}
    </div>
  );
};

export default BasketEstimator;
