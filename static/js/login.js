window.addEventListener("load", () => {
    /** @type {HTMLFormElement} */
    const loginForm = document.getElementById("login-form");
    const loginFormParent = document.getElementById("login-form-parent");
    const updateSize = setupCircleResize(loginForm);
    updateSize();
    loginFormParent.classList.remove("hidden");
});