document
  .getElementById("contactForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    let isValid = true;
    let name = document.getElementById("name");
    let email = document.getElementById("email");
    let message = document.getElementById("message");

    // Reset previous error states
    name.classList.remove("invalid");
    email.classList.remove("invalid");
    message.classList.remove("invalid");

    if (name.value === "") {
      name.classList.add("invalid");
      isValid = false;
    }

    if (email.value === "") {
      email.classList.add("invalid");
      isValid = false;
    }

    if (!validateEmail(email.value)) {
      email.classList.add("invalid");
      isValid = false;
    }

    if (message.value === "") {
      message.classList.add("invalid");
      isValid = false;
    }

    if (isValid) {
      alert("Form submitted successfully");
    }
  });

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}
