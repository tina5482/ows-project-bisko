document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("contactForm");

  form.addEventListener("submit", function (event) {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const message = document.getElementById("message").value;

    if (!name || !email || !message) {
      alert("All fields must be filled out.");
      event.preventDefault();
    } else if (!validateEmail(email)) {
      alert("Please enter a valid email address.");
      event.preventDefault();
    }
    showHideForm();
    event.preventDefault();
  });

  function validateEmail(email) {
    return email.includes("@");
  }

  function showHideForm() {
    var obrub = document.getElementById("form-obrub");
    var txt = document.getElementById("msg-txt");
    if (obrub.style.display === "none") {
      obrub.style.display = "block";
      txt.style.display = "none";
    } else {
      obrub.style.display = "none";
      txt.style.display = "flex";
      document.getElementById("name").value = "";
      document.getElementById("email").value = "";
      document.getElementById("message").value = "";
    }
  }
  document.getElementById("natrag-button").onclick = showHideForm;
});

document.addEventListener("DOMContentLoaded", () => {
  const navbarToggle = document.getElementById("navbar-toggle");
  const sidebar = document.getElementById("sidebar");
  const closeBtn = document.getElementById("close-btn");

  navbarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar-active");
  });

  closeBtn.addEventListener("click", () => {
    sidebar.classList.remove("sidebar-active");
  });

  document.addEventListener("click", (event) => {
    if (
      !sidebar.contains(event.target) &&
      !navbarToggle.contains(event.target)
    ) {
      sidebar.classList.remove("sidebar-active");
    }
  });
});
