const socket = io("https://apis.erzen.xyz:3000", {
  query: {
    token: localStorage.getItem("token"),
  },
});

socket.on("refreshMessages", async () => {});
