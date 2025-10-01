import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from 'date-fns';
import sound from "../../assets/notification.mp3";

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ["websocket"],
  auth: {
    userid: null,
    displayName: null
  }
});

function Talk() {
  const [ready, setReady] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [islogin, setIslogin] = useState(false);
  const chatEndRef = useRef(null);
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false); 
  const [isAnonymousInChatName, setIsAnonymousInChatName] = useState(false); 

  const { user } = useAuth();

  // Update socket auth when user changes
  useEffect(() => {
    if (user) {
      socket.auth = {
        userid: user.uid,
        displayName: user.displayName || 'Anonymous'
      };
      socket.connect();
    }
  }, [user]);

  // Fetch previous messages when user logs in
  useEffect(() => {
    const fetchPreviousMessages = async () => {
      if (user) {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/talkmsg`);
          if (!response.ok) {
            throw new Error('Failed to fetch previous messages');
          }
          const previousMessages = await response.json();
          setMessages(previousMessages);
        } catch (error) {
          console.error('Error fetching previous messages:', error);
        }
      }
    };

    fetchPreviousMessages();
  }, [user]);

  useEffect(() => {
    if (user) {
      console.log(user);
      setIsLoaded(true);
      setIslogin(true);
      
      // Listen for messages from other users
      socket.on("m", (msg) => {
        // Check if the message is not from the current user
        if (msg.userid !== user.uid) {
          const notification = new Audio(sound);
          notification.play();    
          setMessages((prevMessages) => [...prevMessages, { 
            role: "Server", 
            text: msg.text, 
            userid: msg.userid,
            displayName: msg.displayName,
            createdAt: new Date()
          }]);
        }
      });

      return () => {
        socket.off("m");
      };
    }
    else{
      setIsLoaded(false);
      setIslogin(false);
    }
  }, [user, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (message.trim() !== "") {
      const newMessage = { 
        role: "user", 
        text: message, 
        userid: user.uid,
        displayName: isAnonymousInChatName ? 'Anonymous' : user.displayName || 'Anonymous',
        createdAt: new Date()
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);

      // Emit the message to the server
      socket.emit("user-message", {
        ...newMessage,
        userid: user.uid
      });

      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/talkmsg`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(newMessage),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to save message");
        }
      } catch (error) {
        console.error("Error saving message:", error);
      }

      setMessage("");
    } else {
      alert("Enter message before sending");
    }
  };

  const handleAnonymousToggle = () => {
    setIsAnonymousInChatName((isAnonymousInChatName) => !isAnonymousInChatName);
  }

  return (
    <div className="w-full flex items-center justify-center mx-0 my-0">
      <div className="bg-[#ffdad7] h-[75vh] px-5 md:p-11 md:pt-2 my-10 pt-2 rounded-xl shadow-2xl mx-5 md:mx-0 overflow-auto flex flex-col justify-between md:w-[1200px]">
        <Toggle handleAnonymousToggle={handleAnonymousToggle} isAnonymousInChatName={isAnonymousInChatName} />
        {isLoaded ? (
          <>
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${
                      message.userid === user.uid ? "text-right" : "text-left"
                    }`}
                  >
                    {message.userid === user.uid ? (
                      <div className="chat chat-end">
                        <div className="chat-image avatar">
                          <div className="w-10 rounded-full">
                            <img
                              alt="User avatar"
                              src={"https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"}
                            />
                          </div>
                        </div>
                        <div className="chat-header text-black c">
                          {message.displayName}
                        </div>
                        <div className="chat-bubble bg-[#F8A199] text-black">{message.text}</div>
                        <div className="chat-footer text-black">
                          <time className="text-xs opacity-50 text-black ml-2">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </time>
                        </div>
                      </div>
                    ) : (
                      <div className="chat chat-start">
                        <div className="chat-image avatar">
                          <div className="w-10 rounded-full">
                            <img
                              alt="Other user avatar"
                              src={"https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"}
                            />
                          </div>
                        </div>
                        <div className="chat-header text-black font-semibold">
                          {message.displayName}
                        </div>
                        <div className="chat-bubble bg-[#e71f1f]">
                          {message.text}
                        </div>
                        <div className="chat-footer text-black">
                          <time className="text-xs opacity-50 text-black ml-2">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </time>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="text"
                className="flex-1 p-3 border bg-white text-black border-gray-400 focus:outline-none rounded-xl min-w-[100px]"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
                disabled={!ready}
              />
              <button
                className={`p-3 ml-3 rounded-xl text-white font-semibold ${
                  ready
                    ? "bg-[#e71f1f] hover:bg-[#F8A199] hover:text-black"
                    : "bg-gray-400"
                }`}
                onClick={sendMessage}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#e71f1f] mb-3 md:text-4xl">
                Want to Join the Conversation?
              </h2>
              <p className="text-lg mb-6 max-w-md md:text-xl font-medium text-black">
                Ready to experience real-time chats and connect with others? To
                access this feature, please log in to your account first.
              </p>
              <button
                onClick={() => navigate("/login?redirect=/talk")}
                className="bg-[#e71f1f] hover:bg-[#F8A199] text-white hover:text-black font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
              >
                Go to Login Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Toggle = ({isAnonymousInChatName, handleAnonymousToggle}) => {
  return (
    <div className="bg-white/40 backdrop-blur-sm rounded-lg p-4 mb-4 border border-[#e71f1f]/20 shadow-sm">
      <label
        htmlFor="anonymousToggle"
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center space-x-3">
          <div className="bg-[#e71f1f] p-2 rounded-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <div className="text-[#BE123C] font-bold text-base">Anonymous Mode</div>
            <div className="text-xs text-gray-700">
              {isAnonymousInChatName ? "Your messages appear as Anonymous" : "Your display name is visible"}
            </div>
          </div>
        </div>
        
        <input
          id="anonymousToggle"
          type="checkbox"
          checked={isAnonymousInChatName}
          onChange={handleAnonymousToggle}
          className="sr-only"
          aria-label={isAnonymousInChatName ? "Disable anonymous mode" : "Enable anonymous mode"}
          title="Send messages as Anonymous"
        />
        <div
          className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#e71f1f] ${
            isAnonymousInChatName ? "bg-[#e71f1f]" : "bg-gray-300"
          }`}
          aria-hidden="true"
        >
          <div
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 transform flex items-center justify-center ${
              isAnonymousInChatName ? "translate-x-7" : "translate-x-0"
            }`}
          >
            {isAnonymousInChatName ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#e71f1f"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                <line x1="3" y1="3" x2="21" y2="21" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </div>
        </div>
      </label>
    </div>
  );
}

export default Talk;