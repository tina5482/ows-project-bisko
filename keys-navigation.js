document.addEventListener("keydown", keyDownTextField, false);

const pages = ["index.html", "about.html", "gallery.html", "contact.html"];

function keyDownTextField(e) {
  var currentPage = window.location.href.split("/").at(-1);
  var index = pages.indexOf(currentPage);

  var keyCode = e.keyCode;
  if (keyCode == 37) {
    var newIndexBack = index - 1 < 0 ? pages.length - 1 : index - 1;
    window.location.href = pages[newIndexBack];
  }
  if (keyCode == 39) {
    var newIndexFront = index + 1 >= pages.length ? 0 : index + 1;
    window.location.href = pages[newIndexFront];
  }
}

function findIndexOfPage(page) {
  array.forEach((element) => {});
}
