document.addEventListener('DOMContentLoaded', () => {
  const socket = io('http://localhost:5500');

  // Prompt the user for their email
  const email = prompt("Enter your email:");
  
  // Check if the email is provided
  if (email) {
    // Send the email for authentication
    socket.emit("authenticate", email);
    
    // DOM elements
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatMessages = document.getElementById("chat-messages");
  
    // Audio elements for notification sounds
    const incomingMessageAudio = new Audio('ping.mp3');
    const outgoingMessageAudio = new Audio('pong.mp3');
  
    // Event listener for the Send button
    sendButton.addEventListener("click", () => {
      const message = messageInput.value.trim();
      if (message !== "") {
        // Send the message to the server
        socket.emit("chat message", message);
        messageInput.value = ""; // Clear the input field
  
        // Play the outgoing message sound
        outgoingMessageAudio.play();
      }
    });
  
    // Event listener for incoming chat messages
    socket.on("chat message", ({ username, message }) => {
      const messageElement = document.createElement("div");
      messageElement.textContent = `${username}: ${message}`;
    // ...

    // Event listener for incoming error messages
    socket.on("message error", (errorMessage) => {
      alert(errorMessage); // Display the error message to the user
    });

    // ...

      // Check if the message is sent by the user or received from others
      if (username === "You") {
        messageElement.classList.add("message", "own-message", "message-animation");
      } else {
        messageElement.classList.add("message", "received-message", "message-animation");
        // Play the incoming message sound
        incomingMessageAudio.play();
      }
  
      // Generate a random background color for different users
      const randomColor = getRandomColor();
      messageElement.style.backgroundColor = randomColor;
  
      chatMessages.appendChild(messageElement);
  
      // Scroll to the bottom of the chat container
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  
    // Event listener for user connected
    socket.on("user connected", (usernames) => {
      // Update the list of connected usernames
      // For example, you can display them in a separate element
      const connectedUsersElement = document.getElementById("connected-users");
      connectedUsersElement.textContent = `Connected Users: ${usernames.join(", ")}`;
    });
  } else {
    alert("Email not provided. You cannot send messages.");
  }
});

// Function to generate a random color
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
