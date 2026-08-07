import { useState } from 'react';
import { Share2, MessageCircle, Copy } from 'lucide-react';

const SocialShare = ({ url, title, description, image }) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareData = {
    title: title || 'PR Nexus FishMart - Fresh Fish Every Morning',
    text: description || 'Check out the freshest fish at the best prices!',
    url: url || window.location.href
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      setShowShareMenu(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.log('Error copying:', err);
    }
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`${shareData.text} ${shareData.url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="relative">
      <button
        onClick={handleNativeShare}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-opacity-90 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        <span>Share</span>
      </button>

      {showShareMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowShareMenu(false)}
          />
          
          {/* Share Menu */}
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border z-50 min-w-64">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Share this page</h3>
              <div className="space-y-2">
                <button
                  onClick={handleWhatsAppShare}
                  className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-green-50 rounded-lg transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  <span>WhatsApp</span>
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Copy className="w-5 h-5 text-gray-600" />
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SocialShare;
