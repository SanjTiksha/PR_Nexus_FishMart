/**
 * Bulk Import Fish Data to Firestore
 * Run this once to import all fish from the provided JSON array
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where 
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const COLLECTIONS = {
  FISHES: "fishes"
};

/**
 * Bulk import fish data to Firestore
 * @param {Array} fishArray - Array of fish objects
 */
export const bulkImportFish = async (fishArray) => {
  try {
    console.log("🔄 Starting bulk import of", fishArray.length, "fish...");

    // Get existing fishes to avoid duplicates
    const existingFishes = await getDocs(collection(db, COLLECTIONS.FISHES));
    const existingNames = new Set(existingFishes.docs.map(doc => doc.data().name?.toLowerCase()));

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const fish of fishArray) {
      try {
        // Check if fish already exists by name
        const fishNameLower = fish.name?.toLowerCase();
        if (existingNames.has(fishNameLower)) {
          console.log(`⏭️ Skipping ${fish.name} - already exists`);
          skipped++;
          continue;
        }

        // Map to Firestore structure
        const firestoreDoc = {
          name: fish.name || '',
          category: fish.category || 'Seawater',
          rate: parseInt(fish.rate) || 0,
          unit: 'KG', // Default unit
          image: fish.image || '',
          available: fish.available !== undefined ? fish.available : (fish.rate > 0),
          Fish_description: fish.Fish_description || '',
          Other_info: fish.Other_info || ''
        };

        // Add to Firestore
        await addDoc(collection(db, COLLECTIONS.FISHES), firestoreDoc);
        existingNames.add(fishNameLower); // Track in current batch
        imported++;
        console.log(`✅ Imported: ${fish.name}`);
      } catch (error) {
        console.error(`❌ Error importing ${fish.name}:`, error);
        errors++;
      }
    }

    console.log("\n📊 Import Summary:");
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total: ${fishArray.length}`);

    return {
      imported,
      skipped,
      errors,
      total: fishArray.length
    };
  } catch (error) {
    console.error("❌ Bulk import failed:", error);
    throw error;
  }
};

/**
 * Fish data from user - Row_no 1 (Rohu) already created in Firestore, so starting from Row_no 2
 */
export const fishImportData = [
  { Row_no: 2, name: "Silan", rate: 120, category: "Seawater", available: true, image: "", Fish_description: "Silan is a popular seawater fish prized for its soft texture and delicate taste. It provides lean protein and is easy to cook, making it a versatile choice for everyday meals.", Other_info: "Perfect for shallow fry or light gravies — landed fresh daily from coastal markets." },
  { Row_no: 3, name: "RC", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "RC is a local seawater fish with a rich flavour and firm meat. High in Omega-3s and natural minerals, it's great for balanced nutrition and robust coastal dishes.", Other_info: "Good for curry or deep fry — a favourite for hearty family meals." },
  { Row_no: 4, name: "Bangda", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Bangda (mackerel) is packed with omega-3 fatty acids which support heart and brain health. Its oily, flavourful flesh grills and fries beautifully for an indulgent yet nutritious meal.", Other_info: "Perfect for fry or grill recipes — rich, healthy, and flavourful." },
  { Row_no: 5, name: "Bombil", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Bombil (Bombay Duck) has a soft, delicate flesh and a unique coastal flavour. Light and tasty, it's a beloved ingredient in regional cuisine and a good source of lean protein.", Other_info: "Crispy fried Bombil is a coastal favourite — best when extremely fresh." },
  { Row_no: 6, name: "Bam Pili", rate: 630, category: "Seawater", available: true, image: "", Fish_description: "Bam Pili is a premium eel-type catch with rich flavour and succulent meat. High in protein and flavorful oils, it's an excellent choice for special-occasion curries and grills.", Other_info: "Perfect for spicy curry or grill — a premium treat for flavour lovers." },
  { Row_no: 7, name: "Nadi Bam", rate: 600, category: "Freshwater", available: true, image: "", Fish_description: "Nadi Bam is a river eel with soft flesh and delicate taste. It's rich in protein and prized in local cuisines for its luxurious texture and ability to soak up spices.", Other_info: "Ideal for local-style curry — freshly sourced from river catches." },
  { Row_no: 8, name: "Tarli", rate: 290, category: "Seawater", available: true, image: "", Fish_description: "Tarli is a small oily fish full of flavour and natural oils. It delivers good nutrition (including Omega-3s) and is perfect for home fry dishes that are crispy and satisfying.", Other_info: "Common for home fry dishes — a tasty everyday choice." },
  { Row_no: 9, name: "Kuppa", rate: 240, category: "Seawater", available: true, image: "", Fish_description: "Kuppa is a medium-sized seawater fish with a balanced taste and firm flesh. It's nutritious, easy to cook, and works well in curries and pan-fried preparations.", Other_info: "Good for curry or fry — versatile and family-friendly." },
  { Row_no: 10, name: "Kantal Big", rate: 680, category: "Seawater", available: true, image: "", Fish_description: "Kantal Big is a large pomfret-style fish with a firm, delicate texture. It's ideal for grilling and tandoori-style recipes and is prized for its premium quality and presentation.", Other_info: "Premium fish ideal for grilling — great for special meals." },
  { Row_no: 11, name: "Halwa", rate: 780, category: "Seawater", available: true, image: "", Fish_description: "Halwa is a black pomfret variant noted for rich flavour and soft meat. It's an excellent protein source and fries or grills to a tender finish with a delicious crust.", Other_info: "Perfect for pan fry or tawa fry — a coastal classic." },
  { Row_no: 12, name: "Surmai Bambu", rate: 850, category: "Seawater", available: true, image: "", Fish_description: "Surmai Bambu (kingfish) is a premium catch loved for firm, meaty flesh and strong flavour. High in protein and ideal for steaks, grills, and rich curries.", Other_info: "Excellent for grill or curry — a top pick for restaurants and homes." },
  { Row_no: 13, name: "Baby Surmai", rate: 0, category: "Seawater", available: false, image: "", Fish_description: "Baby Surmai is a young variant of kingfish with delicate flesh. Currently unavailable — keep an eye on stock or enquire for next supply.", Other_info: "Currently out of stock. Please check back or enquire for availability." },
  { Row_no: 14, name: "Kat Bangada", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "Kat Bangada provides convenient pieces of Bangda (mackerel) ideal for quick curries. Nutritious and flavourful, it's perfect for homestyle spicy gravies.", Other_info: "Good for spicy masala gravy — easy to cook and full of flavour." },
  { Row_no: 15, name: "Chilapi", rate: 140, category: "Freshwater", available: true, image: "", Fish_description: "Chilapi is a light-tasting freshwater fish with tender flesh, making it ideal for gentle frying and family meals. It's nutritious and easy on the palate.", Other_info: "Best cooked shallow fried — a simple, tasty option for daily meals." },
  { Row_no: 16, name: "Kantal Small", rate: 560, category: "Seawater", available: true, image: "", Fish_description: "Kantal Small is a smaller pomfret variety known for soft meat and delicate flavour. It's excellent for tawa fry and makes for a refined home-cooked dish.", Other_info: "Great for home cooking — tender and easy to serve." },
  { Row_no: 17, name: "Katla", rate: 190, category: "Freshwater", available: true, image: "", Fish_description: "Katla is a popular freshwater fish with a slightly fatty belly and rich taste. It's an excellent source of protein and essential nutrients, perfect for hearty curries.", Other_info: "Perfect for curry — loved across households for its flavour." },
  { Row_no: 18, name: "Mandeli", rate: 200, category: "Seawater", available: true, image: "", Fish_description: "Mandeli is a tiny golden coastal fish known for crisp, flavourful frying. Nutritious and loved for its crunchy texture when deep fried.", Other_info: "Ideal for deep fry — small, crispy, and family favourite." },
  { Row_no: 19, name: "Chor Bombil", rate: 210, category: "Seawater", available: true, image: "", Fish_description: "Chor Bombil is a variant of Bombil with soft flesh and a distinctive coastal taste. It's rich in protein and delivers excellent fried texture.", Other_info: "Tasty when fried — a popular dish in coastal households." },
  { Row_no: 20, name: "Paplate 80up", rate: 750, category: "Seawater", available: true, image: "", Fish_description: "Paplate 80up indicates premium-size pomfret with delicate white meat. Low in fat and high in protein, it's ideal for special tawa preparations and celebrations.", Other_info: "Delicate white meat — great for tawa fry and special dishes." },
  { Row_no: 21, name: "Paplate 150", rate: 980, category: "Seawater", available: true, image: "", Fish_description: "Paplate 150 is a large, premium pomfret variety with succulent flesh and refined taste. Perfect for restaurants or special family meals looking for premium quality.", Other_info: "Perfect for tawa fry — premium and restaurant-quality." },
  { Row_no: 22, name: "Shingta", rate: 480, category: "Freshwater", available: true, image: "", Fish_description: "Shingta (freshwater catfish) has a tender texture and mild flavour. High in protein, it adapts well to rich curries and slow-cooked recipes.", Other_info: "Great for curry — tender meat with comforting flavour." },
  { Row_no: 23, name: "Shingada", rate: 280, category: "Freshwater", available: true, image: "", Fish_description: "Shingada is a small freshwater fish with soft bones and delicate taste. It's traditional in rural recipes and offers gentle, homely flavours.", Other_info: "Used in regional recipes — small, flavourful, and comforting." },
  { Row_no: 24, name: "Doller", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "Doller is a round fish similar to pomfret with a pleasing taste and texture. It's a nutritious protein source and fries to a crisp golden finish.", Other_info: "Tasty when fried — great everyday value." },
  { Row_no: 25, name: "Rawas", rate: 800, category: "Seawater", available: true, image: "", Fish_description: "Rawas (Indian salmon) is a premium coastal fish celebrated for its rich flavour and firm texture. Rich in Omega-3s, it's great for grills, steaks, and hearty curries.", Other_info: "Excellent for grill or curry — a top-quality, flavorful choice." },
  { Row_no: 26, name: "Khajura", rate: 600, category: "Seawater", available: true, image: "", Fish_description: "Khajura is a medium seawater fish with a mild and approachable flavour. It's a nutritious option that cooks quickly and pairs well with bold spices.", Other_info: "Best cooked fried — easy, tasty, and versatile." },
  { Row_no: 27, name: "Palla", rate: 1100, category: "Seawater", available: true, image: "", Fish_description: "Palla is a rare, high-value fish known for delicate flavor and luxurious texture. Perfect for special menus where premium taste matters.", Other_info: "Available seasonally — ideal for special-occasion cooking." },
  { Row_no: 28, name: "Crab Meat", rate: 550, category: "Seawater", available: true, image: "", Fish_description: "Fresh cleaned crab meat is ready to cook and rich in flavour. It's a lean protein source with a sweet, delicate taste that works well in gravies and starters.", Other_info: "Ready to cook — great for curries, pastas, and special dishes." },
  { Row_no: 29, name: "Bombh12", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "Bombh12 is a local seawater fish variety with firm taste and versatility. It's nutritious, flavorful, and suitable for everyday curries.", Other_info: "Used for curry — dependable and tasty." },
  { Row_no: 30, name: "Kantal", rate: 400, category: "Seawater", available: true, image: "", Fish_description: "Kantal (silver pomfret) is prized for its soft flesh and exquisite taste. Delicate and mild, it is a classic coastal favourite for family gatherings.", Other_info: "Classic coastal favourite — soft, tender, and delicious." },
  { Row_no: 31, name: "Ghol", rate: 400, category: "Seawater", available: true, image: "", Fish_description: "Ghol (golden corvina) is a premium fish with a soft, near-boneless texture. It's favored for its fine flakes and restaurant-quality mouthfeel.", Other_info: "Premium texture — excellent for special curries." },
  { Row_no: 32, name: "Bangadi", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "Bangadi is a small coastal fish often fried or used in quick family meals. It's affordable, tasty, and a good source of daily protein.", Other_info: "Fried for local meals — budget-friendly and delicious." },
  { Row_no: 33, name: "Surmai Bambu 2", rate: 900, category: "Seawater", available: true, image: "", Fish_description: "Surmai Bambu 2 is a larger kingfish variant prized for steaks and substantial cuts. It's meaty, flavourful, and excellent for high-impact dishes.", Other_info: "Ideal for steaks and grills — upscale and satisfying." },
  { Row_no: 34, name: "Khapi", rate: 290, category: "Seawater", available: true, image: "", Fish_description: "Khapi is a small fish with a sweet taste, great for fry preparations and family meals. It's nutritious and cooks quickly.", Other_info: "Perfect for fry — quick, tasty, and family friendly." },
  { Row_no: 35, name: "Chaiti", rate: 540, category: "Seawater", available: true, image: "", Fish_description: "Chaiti is a medium-sized fish with a flavorful meat profile. It's excellent for coastal curries and adds a refined taste to everyday cooking.", Other_info: "Best for coastal curry — flavorful and satisfying." },
  { Row_no: 36, name: "Karli", rate: 440, category: "Seawater", available: true, image: "", Fish_description: "Karli is a coastal fish with fine bones and delicate flavour. It's ideal for tawa fry and family recipes that highlight gentle spices.", Other_info: "Used for tawa fry — delicate and tasty." },
  { Row_no: 37, name: "Veral I", rate: 230, category: "Seawater", available: true, image: "", Fish_description: "Veral I has firm flesh and an appealing coastal flavour, commonly used in Konkan cuisine. It's nutritious and delivers a great texture when cooked properly.", Other_info: "Common in Konkan cuisine — firm and delicious." },
  { Row_no: 38, name: "Rani", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Rani is a pink fish with a naturally sweet flavour and tender flesh. It cooks beautifully and suits a range of home-style and festive recipes.", Other_info: "Ideal for home cooking — sweet, mild, and reliable." },
  { Row_no: 39, name: "Saundara", rate: 400, category: "Seawater", available: true, image: "", Fish_description: "Saundara is a soft-fleshed fish with mild flavour—great for people who prefer subtle taste profiles. It's versatile across curries and grills.", Other_info: "Good for curry or fry — gentle flavour and easy cooking." },
  { Row_no: 40, name: "Crab", rate: 520, category: "Seawater", available: true, image: "", Fish_description: "Fresh live crabs are prized for sweet, succulent meat and rich taste. They are a protein-dense delicacy perfect for masala curries and special menus.", Other_info: "Perfect for masala curry — lively, fresh, and delicious." },
  { Row_no: 41, name: "Big Silan", rate: 135, category: "Seawater", available: true, image: "", Fish_description: "Big Silan is a larger version of Silan with more meat and the same soft texture. It's an economical, tasty option for family meals.", Other_info: "Soft flesh and rich taste — great value." },
  { Row_no: 42, name: "Kala Tolka", rate: 320, category: "Seawater", available: true, image: "", Fish_description: "Kala Tolka is a medium-sized black tolka fish with a robust flavour. It's excellent in spicy curries and gives a rich coastal taste.", Other_info: "Ideal for curry — full-bodied flavour." },
  { Row_no: 43, name: "Pila Tolka", rate: 780, category: "Seawater", available: true, image: "", Fish_description: "Pila Tolka (yellow tolka) is a rare, flavorful fish suitable for grilling or premium curries. It's prized by chefs for its texture and taste.", Other_info: "Excellent grilled — a rare and delicious choice." },
  { Row_no: 44, name: "Narvi", rate: 0, category: "Seawater", available: false, image: "", Fish_description: "Narvi is currently unavailable; it's a seasonal product when in stock and appreciated for its coastal taste.", Other_info: "Currently out of stock. Please check back or enquire for availability." },
  { Row_no: 45, name: "Tisri", rate: 280, category: "Seawater", available: true, image: "", Fish_description: "Tisri (clams) are a coastal delicacy with a briny, rich flavour. They add depth to Malvani and regional curries and are a good seafood protein source.", Other_info: "Used in Malvani curry — authentic coastal flavour." },
  { Row_no: 46, name: "Pabda", rate: 560, category: "Freshwater", available: true, image: "", Fish_description: "Pabda is a boneless freshwater fish prized for its smooth texture and delicate flavour. It's perfect for light, aromatic curries and family meals.", Other_info: "Ideal for curry — smooth texture and premium taste." },
  { Row_no: 47, name: "Kapasi", rate: 440, category: "Seawater", available: true, image: "", Fish_description: "Kapasi is a medium white fish with soft meat and mild flavour. It works well in homestyle curries and is a nutritious everyday option.", Other_info: "Used in local curries — mild and easy to cook." },
  { Row_no: 48, name: "Surmai Tavar", rate: 780, category: "Seawater", available: true, image: "", Fish_description: "Surmai Tavar (kingfish tail portion) provides concentrated flavour and is excellent for spicy curries and hearty stews. It's high in protein and texture-rich.", Other_info: "Perfect for spicy curry — intense flavour from the tail cut." },
  { Row_no: 49, name: "Halwa 2", rate: 730, category: "Seawater", available: true, image: "", Fish_description: "Halwa 2 is a pomfret-style fish with tender meat and rich taste—great when pan-fried or prepared with light spices.", Other_info: "Rich in flavour — perfect for tawa fry and family dinners." },
  { Row_no: 50, name: "Mori", rate: 390, category: "Seawater", available: true, image: "", Fish_description: "Mori is a shark-type fish with firm flesh and bold taste, lending itself well to coastal recipes and strong, spice-forward curries.", Other_info: "Commonly cooked in Konkan — firm texture, bold flavour." },
  { Row_no: 51, name: "Madosa", rate: 850, category: "Seawater", available: true, image: "", Fish_description: "Madosa is a premium seawater fish with white flaky flesh and excellent taste. It's perfect for special curries and restaurant-quality dishes.", Other_info: "Good for curry — premium and satisfying." },
  { Row_no: 52, name: "Dhoma", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Dhoma is a soft fish suited for everyday curries and family meals. It's an affordable, tasty option that absorbs spices well.", Other_info: "Daily catch — dependable and tasty." },
  { Row_no: 53, name: "Tambushi", rate: 480, category: "Seawater", available: true, image: "", Fish_description: "Tambushi is a thick white fish with soft texture, commonly used along the Maharashtra coast for tawa fry and rich gravies.", Other_info: "Famous in Maharashtra coast — thick flesh and great for frying." },
  { Row_no: 54, name: "Indian Basa", rate: 265, category: "Freshwater", available: true, image: "", Fish_description: "Indian Basa is a farmed freshwater fish known for boneless fillets and mild flavour. It's great for grilling, frying, and family-friendly recipes.", Other_info: "Boneless and mild — perfect for easy cooking and fillets." },
  { Row_no: 55, name: "Basa", rate: 240, category: "Freshwater", available: true, image: "", Fish_description: "Basa fillets are mild, flaky, and easy to cook. A good source of protein, they're ideal for quick pan-fries and healthy weeknight meals.", Other_info: "Great for grill or fry — boneless and convenient." },
  { Row_no: 56, name: "41/50 Prawns G2", rate: 0, category: "Seawater", available: false, image: "", Fish_description: "41/50 Prawns G2 (frozen category) are currently out of stock — small prawns category used for light preparations when available.", Other_info: "Currently unavailable — please enquire for next shipment." },
  { Row_no: 57, name: "31/40 Prawns", rate: 480, category: "Seawater", available: true, image: "", Fish_description: "31/40 prawns are a medium-sized prawn category ideal for frying, curries, and skewers. They're succulent, protein-rich, and quick to cook.", Other_info: "Ideal for fry — versatile and juicy." },
  { Row_no: 58, name: "16/20 Prawns", rate: 10, category: "Seawater", available: true, image: "", Fish_description: "16/20 prawns are large prawns with firm texture and a premium mouthfeel. Great for special curries, grill, and tandoori-style preparations.", Other_info: "Used for premium curry — meaty and satisfying." },
  { Row_no: 59, name: "21/25 Prawns", rate: 600, category: "Seawater", available: true, image: "", Fish_description: "21/25 prawns are sizable and perfect for grilling and premium dishes. Rich in protein and natural juices, they're a delight in prawn-centric recipes.", Other_info: "Perfect for grill — premium and flavorful." },
  { Row_no: 60, name: "Toki", rate: 540, category: "Seawater", available: true, image: "", Fish_description: "Toki is a local seawater fish with a delicious fry profile. It's nutritionally dense and loved for its taste when shallow or deep fried.", Other_info: "Delicious when fried — a local favourite." },
  { Row_no: 61, name: "Karimind", rate: 300, category: "Seawater", available: true, image: "", Fish_description: "Karimind is a medium-flavoured seawater fish with robust taste. It's suitable for coastal dishes and adds character to spicy curries.", Other_info: "Used for coastal dishes — flavorful and dependable." },
  { Row_no: 62, name: "Cut Black Vam", rate: 560, category: "Seawater", available: true, image: "", Fish_description: "Cut Black Vam offers convenient pieces of black vam for curries and stews. It brings a deep coastal flavour and cooks evenly.", Other_info: "Used in spicy curry — convenient cut for quick cooking." },
  { Row_no: 63, name: "Pivli Cut Vam", rate: 900, category: "Seawater", available: true, image: "", Fish_description: "Pivli Cut Vam (yellow vam cut) is a premium variety with desirable flavour and texture — ideal for rich curries and special menus.", Other_info: "Excellent flavour — premium cut for restaurants and homes." },
  { Row_no: 64, name: "Khaulti Kuppa", rate: 320, category: "Seawater", available: true, image: "", Fish_description: "Khaulti Kuppa is a small, locally popular seawater fish with bright flavour notes and easy preparation for family meals.", Other_info: "Locally popular — easy to cook and tasty." },
  { Row_no: 65, name: "300UP Khaprat", rate: 1500, category: "Seawater", available: true, image: "", Fish_description: "300UP Khaprat is a large premium catch with firm meat and excellent flavour — a high-end selection ideal for showpiece dishes.", Other_info: "High-quality catch — premium choice for special occasions." },
  { Row_no: 66, name: "Big Kapri", rate: 1300, category: "Seawater", available: true, image: "", Fish_description: "Big Kapri is a huge fish with firm, steak-like meat — perfect for carving steaks or premium restaurant plates.", Other_info: "Ideal for steak cuts — substantial and meaty." },
  { Row_no: 67, name: "White", rate: 730, category: "Seawater", available: true, image: "", Fish_description: "White is a mild-flavoured seawater fish with soft flesh that is versatile across frying, grilling, and curries. A nutritious option for family meals.", Other_info: "Good for fry — mild and versatile." },
  { Row_no: 68, name: "Lobster", rate: 650, category: "Seawater", available: true, image: "", Fish_description: "Lobster is a premium shellfish with rich, sweet meat—perfect for gourmet dishes. Packed with protein and luxurious texture for special menus.", Other_info: "Used for grill or butter garlic — indulgent and premium." },
  { Row_no: 69, name: "Makul", rate: 580, category: "Seawater", available: true, image: "", Fish_description: "Makul is a medium-sized white fish known for soft flesh and mild taste. It's easy to cook and performs well in homestyle and restaurant dishes.", Other_info: "Soft flesh and mild flavour — great for versatile recipes." },
  { Row_no: 70, name: "Polan", rate: 240, category: "Seawater", available: true, image: "", Fish_description: "Polan is a small, soft-fleshed fish ideal for local fry recipes. Affordable and tasty, it is a reliable choice for everyday cooking.", Other_info: "Ideal for local fry — simple and satisfying." },
  { Row_no: 71, name: "300 Paplate", rate: 1500, category: "Seawater", available: true, image: "", Fish_description: "300 Paplate is a premium large pomfret prized for its texture and delicate taste. A top-tier choice for celebratory menus and fine dining.", Other_info: "High-end restaurant fish — premium and luxurious." },
  { Row_no: 72, name: "Danda", rate: 850, category: "Seawater", available: true, image: "", Fish_description: "Danda is a medium coastal fish with robust taste suitable for spicy coastal curries. It's hearty and satisfying.", Other_info: "Great for spicy curry — reliable and flavoursome." },
  { Row_no: 73, name: "Cut Surmai", rate: 1400, category: "Seawater", available: true, image: "", Fish_description: "Cut Surmai provides premium slices of kingfish ideal for steak-like preparations and spicy curries. It's a preferred choice for premium cooking.", Other_info: "Premium Surmai cuts — excellent for special dishes." },
  { Row_no: 74, name: "Gobra", rate: 400, category: "Seawater", available: true, image: "", Fish_description: "Gobra is a soft white-meat fish with a mild taste—works well in everyday curries and family recipes.", Other_info: "Used for curry — gentle and comforting." },
  { Row_no: 75, name: "Nagli", rate: 200, category: "Seawater", available: true, image: "", Fish_description: "Nagli is a local small fish often used for quick, crisp frying. It's affordable and tasty for daily meals.", Other_info: "Tasty fried — perfect for everyday family meals." },
  { Row_no: 76, name: "Paplate 200", rate: 1250, category: "Seawater", available: true, image: "", Fish_description: "Paplate 200 is a premium pomfret sized for special recipes and rich tawa preparations—delicate and elegant on the plate.", Other_info: "Perfect for tandoor or grill — premium and delicious." },
  { Row_no: 77, name: "Big Rohu", rate: 180, category: "Freshwater", available: true, image: "", Fish_description: "Big Rohu is a larger Rohu variety with more flesh and an excellent texture for family curries. It's rich in protein and satisfying.", Other_info: "Best for curry — hearty and family-sized." },
  { Row_no: 78, name: "Maral", rate: 650, category: "Seawater", available: true, image: "", Fish_description: "Maral is a medium seawater fish that's tender and flavourful—great for coastal recipes and special meals.", Other_info: "Common for coastal cuisine — flavorful and reliable." },
  { Row_no: 79, name: "Live Crab", rate: 320, category: "Seawater", available: true, image: "", Fish_description: "Live crab offers fresh, sweet meat and an authentic coastal flavour for masala curries. Packed with lean protein and seafood nutrients.", Other_info: "Used for curry or masala — lively and fresh." },
  { Row_no: 80, name: "Lep", rate: 280, category: "Seawater", available: true, image: "", Fish_description: "Lep is a flat fish with mild flavour and smooth texture. It's great for light tawa fry and family dishes that appreciate subtle flavours.", Other_info: "Good for tawa fry — mild and approachable." },
  { Row_no: 81, name: "Indian Basa (Dup)", rate: 190, category: "Freshwater", available: true, image: "", Fish_description: "Indian Basa (duplicate entry) is farmed and provides reliable, boneless fillets ideal for easy home cooking. Mild in taste and quick to prepare.", Other_info: "Farm-raised and convenient — good for quick meals." },
  { Row_no: 82, name: "13/15 Prawns", rate: 10, category: "Seawater", available: true, image: "", Fish_description: "13/15 prawns are large, meaty prawns perfect for tandoori dishes, grills, and premium curries. They're rich in protein and great for entertaining.", Other_info: "Used for tandoori dishes — meaty and premium." },
  { Row_no: 83, name: "8/12 Prawns G2", rate: 740, category: "Seawater", available: true, image: "", Fish_description: "8/12 Prawns G2 are extra-large prawns favored for grilling and special recipes. Their firm texture and size make them ideal for showpiece dishes.", Other_info: "Used for grill — showpiece prawns for special meals." },
  { Row_no: 84, name: "100/200 Prawns", rate: 0, category: "Seawater", available: false, image: "", Fish_description: "100/200 Prawns are a small prawn category currently out of stock — popular for light fry and household recipes when available.", Other_info: "Currently unavailable — check back for restock." },
  { Row_no: 85, name: "Spicy Fingers", rate: 210, category: "Other", available: true, image: "", Fish_description: "Spicy Fingers are ready-to-cook fish fingers with a crispy coating and bold spices—convenient and loved by kids and adults alike.", Other_info: "Crispy and spicy snack — convenient and delicious." },
  { Row_no: 86, name: "White Tambushi", rate: 700, category: "Seawater", available: true, image: "", Fish_description: "White Tambushi is a thick white fish with a firm bite and mild taste—excellent for grilling and premium family meals.", Other_info: "Great for grill — thick flesh and restaurant-style texture." },
  { Row_no: 87, name: "Chand", rate: 480, category: "Seawater", available: true, image: "", Fish_description: "Chand is a silver fish with fine bones and a delicate flavour, often used in regional pan-fry and curry recipes.", Other_info: "Used for fry — delicate and traditional." },
  { Row_no: 88, name: "Chand (Dup)", rate: 0, category: "Seawater", available: false, image: "", Fish_description: "Chand (duplicate) is currently out of stock. When available, Chand offers a gentle taste and is commonly used for quick fry recipes.", Other_info: "Out of stock — check availability or enquire." },
  { Row_no: 89, name: "Cutting", rate: 20, category: "Other", available: true, image: "", Fish_description: "Cutting service provides professional cleaning and portioning so your fish is ready to cook. Time-saving and hygienic for home chefs.", Other_info: "Charged per kilogram — handy and hygienic." },
  { Row_no: 90, name: "Tiny", rate: 220, category: "Seawater", available: true, image: "", Fish_description: "Tiny is a small fish mix ideal for local fry and affordable daily meals. Perfect for families seeking flavour on a budget.", Other_info: "Affordable daily fish — great for regular cooking." },
  { Row_no: 91, name: "Khajura (Alt)", rate: 600, category: "Seawater", available: true, image: "", Fish_description: "Khajura (alternate listing) offers mild taste and versatile cooking options—great for frying or light curries.", Other_info: "Best cooked fried — consistent quality." },
  { Row_no: 92, name: "Bombh12 (Alt)", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "Bombh12 (alternate) provides the same local seawater taste — reliable for curries and homestyle dishes.", Other_info: "Used for curry — dependable and tasty." },
  { Row_no: 93, name: "Bombil (Alt)", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Bombil (alternate listing) retains the classic light, tasty flesh that's ideal for frying and coastal recipes.", Other_info: "Crispy fried Bombil — classic coastal flavour." },
  { Row_no: 94, name: "Kantal Small (Alt)", rate: 560, category: "Seawater", available: true, image: "", Fish_description: "Kantal Small (alternate) is a smaller pomfret variant prized for tenderness and home-friendly portion sizes.", Other_info: "Tender and easy to cook — great for families." },
  { Row_no: 95, name: "Surmai Bambu (Alt)", rate: 850, category: "Seawater", available: true, image: "", Fish_description: "Surmai Bambu (alternate) is another listing of premium kingfish — meaty and ideal for grilling or hearty curries.", Other_info: "Excellent for grill or curry — premium cut." },
  { Row_no: 96, name: "Bangda (Alt)", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Bangda (alternate) keeps the classic oily richness and omega-3 benefits — great for family nutrition.", Other_info: "Great for fry or grill — healthy and tasty." },
  { Row_no: 97, name: "Kat Bangada (Alt)", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "Kat Bangada (alternate) offers convenient pieces for quick curry preparation and consistent flavour.", Other_info: "Easy to cook pieces — ideal for busy kitchens." },
  { Row_no: 98, name: "Paplate 80up (Alt)", rate: 750, category: "Seawater", available: true, image: "", Fish_description: "Paplate 80up (alternate) is a premium pomfret option with delicate white meat — elegant and nutritious.", Other_info: "Delicate white meat — premium choice." },
  { Row_no: 99, name: "Paplate 150 (Alt)", rate: 980, category: "Seawater", available: true, image: "", Fish_description: "Paplate 150 (alternate) is a large pomfret prized for special meals and rich flavour profiles.", Other_info: "Excellent for special tawa fry — restaurant-quality." },
  { Row_no: 100, name: "Rohu (Pack)", rate: 155, category: "Freshwater", available: true, image: "", Fish_description: "Rohu (pack) offers convenient portioning of high-quality Rohu, keeping the tender fleshy taste intact — great for family cooking.", Other_info: "Family packs available — perfect for batch cooking." },
  { Row_no: 101, name: "Silan (Pack)", rate: 120, category: "Seawater", available: true, image: "", Fish_description: "Silan (pack) provides a ready set of Silan portions perfect for easy frying and daily meals. Nutritious and convenient.", Other_info: "Value pack — convenient for regular use." },
  { Row_no: 102, name: "RC (Pack)", rate: 160, category: "Seawater", available: true, image: "", Fish_description: "RC (pack) is portioned for easy cooking while retaining rich coastal flavours—good for curries and family dinners.", Other_info: "Pre-portioned packs for convenient cooking." },
  { Row_no: 103, name: "Bangda (Pack)", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Bangda (pack) keeps the healthy, omega-3 rich profile of mackerel while making meal prep quicker and easier.", Other_info: "Pack portions for quick frying and grilling." },
  { Row_no: 104, name: "Bombil (Pack)", rate: 260, category: "Seawater", available: true, image: "", Fish_description: "Bombil (pack) is a convenient preparation of Bombay Duck, perfect for quick crispy frying and family snacks.", Other_info: "Ready portions for quick frying — crowd-pleasing." },
  { Row_no: 105, name: "Bam Pili (Pack)", rate: 630, category: "Seawater", available: true, image: "", Fish_description: "Bam Pili (pack) offers premium eel portions ready for spicy, flavourful cooking — ideal for special family meals.", Other_info: "Premium portions for spice-forward recipes." }
];
