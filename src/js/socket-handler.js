const socket = io("http://localhost:3000", {
  query: {
    token: localStorage.getItem("token"),
  },
});

socket.on("refreshMessages", async () => {});
