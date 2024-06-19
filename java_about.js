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
