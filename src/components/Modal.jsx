function Modal({ children, onClose }) {
  return (
    <div style={overlay}>
      <div style={modal}>
        <button onClick={onClose}>X</button>
        {children}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.5)",
  zIndex: 1000,
  overflowY: "auto",
  padding: "24px 12px",
};

const modal = {
  background: "white",
  padding: "20px",
  margin: "40px auto",
  width: "min(100%, 720px)",
  borderRadius: "12px",
  boxShadow: "0 24px 50px rgba(15, 23, 42, 0.22)",
};

export default Modal;
