export default function NotFound() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>404</h1>
      <p style={styles.text}>Página não encontrada</p>
      <a href="/" style={styles.link}>Voltar ao início</a>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#f5f6fa",
    color: "#2f3640",
  },
  title: {
    fontSize: "5rem",
    color: "#0097e6",
    margin: 0,
  },
  text: {
    fontSize: "1.5rem",
    marginBottom: "1.5rem",
  },
  link: {
    background: "#0097e6",
    color: "white",
    textDecoration: "none",
    padding: "0.8rem 1.5rem",
    borderRadius: "0.5rem",
    transition: "background 0.2s",
  },
};
