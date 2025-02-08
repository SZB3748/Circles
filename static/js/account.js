
window.addEventListener("load", () => {
    const accountInfo = document.getElementById("account-info");
    const accountInfoParent = document.getElementById("account-info-parent");
    const updateSize = setupCircleResize(accountInfo);
    updateSize();
    accountInfoParent.classList.remove("hidden");
});