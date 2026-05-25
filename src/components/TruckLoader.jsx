import React from "react";

function TruckLoader({ text = "Fetching Data..." }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "4rem",
      width: "100%",
      minHeight: "40vh" // Ensures it takes up a nice chunk of the screen
    }}>
      <img 
        // A clean, minimalist truck moving/loading GIF
        src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnNmdnFmanFuZDNiaDJ1M3VhOGZhMDd1b2phb3hycm9ucGQzN21pOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/TIeTxUeyPeFI771jTF/giphy.gif" 
        alt="Loading Truck" 
        style={{ width: "150px", marginBottom: "15px" }}
      />
      <h3 style={{ color: "#475569", fontSize: "1.2rem", margin: 0, fontWeight: "600" }}>
        {text}
      </h3>
    </div>
  );
}

export default TruckLoader;