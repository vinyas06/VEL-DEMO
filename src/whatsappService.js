// src/whatsappService.js

export const sendWhatsAppBookingAlert = async (clientPhoneNumber, bookingData) => {
  // 🔥 Your actual Meta API Keys!
  const ACCESS_TOKEN = "EAAOG8HQw9u8BRPgiK7xY3UGk5uFl1uIuNhgh02IzbLLZBgWaE2UshIF96NGgSNFxPThpNxxpNgUmhvlrpcspbCtvg5uda85wTbMkZAQ4ChZAZAzsPukLPfiA9GmLUG42KZAGFuffsySkvUQMEY4dIhxPIa55nRoMnbosF7d69wyyoNEauMZBw4zhKB2vnpOHnZBEUvPOTKwINHO0ZAgA6zSuxZCV6K05Ep93ZBKQhNrvodHRihF9i0SiKZCwITVNSc6B4SoJI17zOT73sq7yaAlmUWy3QZDZD"; 
  const PHONE_NUMBER_ID = "1087435354451331"; 
  
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
  const formattedNumber = clientPhoneNumber.replace("+", "");

  const payload = {
    messaging_product: "whatsapp",
    to: formattedNumber,
    type: "template",
    template: {
      name: "booking_confirmation", // Ensure this matches your Meta template name!
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: bookingData.partyName },                 
            { type: "text", text: bookingData.from },                      
            { type: "text", text: bookingData.to },                        
            { type: "text", text: bookingData.vehicleNumber },             
            { type: "text", text: String(bookingData.freightAmount) },     
            { type: "text", text: String(bookingData.advanceAmount || 0) } 
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("WhatsApp API Error:", data);
        throw new Error(data.error.message);
    }
    
    console.log("✅ WhatsApp Message sent successfully!");
    return true;

  } catch (error) {
    console.error("WhatsApp Error:", error);
    return false;
  }
};