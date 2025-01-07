// Function to Toggle Navigation Menu
function toggleMenu() {
  const menu = document.querySelector('.menu-links');
  const icon = document.querySelector('.hamburger-icon');
  menu.classList.toggle('open');
  icon.classList.toggle('open');
}

// Animated Typing Text
const textElement = document.querySelector('.animated-text');
const words = ['Developer', 'Designer', 'Creator', 'Student'];
let wordIndex = 0;
let letterIndex = 0;
let isDeleting = false;
const typingSpeed = 100; // Speed of typing
const deletingSpeed = 50; // Speed of deleting
const pause = 2000; // Pause between words

function typeEffect() {
  const currentWord = words[wordIndex];
  
  // Determine the text to display based on whether it's typing or deleting
  if (isDeleting) {
    letterIndex--;
  } else {
    letterIndex++;
  }

  // Update the displayed text
  textElement.textContent = currentWord.slice(0, letterIndex);

  // Adjust timing for typing vs deleting
  let currentSpeed = isDeleting ? deletingSpeed : typingSpeed;

  // Switch to deleting or move to the next word
  if (!isDeleting && letterIndex === currentWord.length) {
    currentSpeed = pause;
    isDeleting = true;
  } else if (isDeleting && letterIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % words.length;
  }

  // Schedule the next typing effect
  setTimeout(typeEffect, currentSpeed);
}

// Start the typing effect
typeEffect();
