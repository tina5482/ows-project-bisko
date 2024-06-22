const galleryContainer = document.querySelector(".center-container");
const popup = document.getElementById("popup");
const popupImage = document.getElementById("popup-image");
const closePopup = document.getElementById("close");
const navLeft = document.getElementById("nav-left");
const navRight = document.getElementById("nav-right");
let currentIndex = 0;
let images = [];

// Collect all images from gallery
galleryContainer.querySelectorAll("img").forEach((img, index) => {
  images.push({
    src: img.src,
    alt: img.alt,
  });
});

galleryContainer.addEventListener("click", (event) => {
  if (event.target.tagName === "IMG") {
    const imageUrl = event.target.src;
    currentIndex = images.findIndex((img) => img.src === imageUrl);
    showImage(currentIndex);
    popup.style.display = "block";
  }
});

closePopup.addEventListener("click", () => {
  popup.style.display = "none";
});

popup.addEventListener("click", (event) => {
  if (event.target === popup) {
    popup.style.display = "none";
  }
});

navLeft.addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  showImage(currentIndex);
});

navRight.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % images.length;
  showImage(currentIndex);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    popup.style.display = "none";
  } else if (event.key === "ArrowLeft") {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    showImage(currentIndex);
  } else if (event.key === "ArrowRight") {
    currentIndex = (currentIndex + 1) % images.length;
    showImage(currentIndex);
  }
});

function showImage(index) {
  popupImage.src = images[index].src;
  popupImage.alt = images[index].alt;
}
