(() => {
  var socket = io();

  socket.on("file-update", function() {
    location.reload();
  });
})();
