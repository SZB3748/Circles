
const USERNAME_ALLOWED = "abcdefghijklmnopqrstuvwxyz0123456789";
const USERNAME_SYMBOLS = "-_.";

window.addEventListener("load", () => {
    /** @type {HTMLFormElement} */
    const loginForm = document.getElementById("login-form");
    const loginFormParent = document.getElementById("login-form-parent");
    const updateSize = setupCircleResize(loginForm);
    updateSize();
    loginFormParent.classList.remove("hidden");

    /** @type {HTMLInputElement} */
    const fieldUsername = document.getElementById("field-username");
    /** @type {HTMLInputElement} */
    const fieldPassword = document.getElementById("field-password");
    /** @type {HTMLInputElement} */
    const fieldConfirmPassword = document.getElementById("field-confirm-password");
    fieldUsername.addEventListener("input", () => {
        fieldUsername.setCustomValidity("");
    });
    fieldConfirmPassword.addEventListener("input", () => {
        fieldConfirmPassword.setCustomValidity("");
    })
    loginForm.addEventListener("submit", ev => {
        if (fieldPassword.value !== fieldConfirmPassword.value) {
            fieldConfirmPassword.setCustomValidity("Must match Password.");
            ev.preventDefault();
            return;
        }
        const v = fieldUsername.value.toLowerCase();
        let lastWasSymbol = false;
        for (let i = 0; i < v.length; i++) {
            if (USERNAME_SYMBOLS.includes(v[i])) {
                if (lastWasSymbol) {
                    fieldUsername.setCustomValidity("Username cannot have 2 symbols in a row.");
                    ev.preventDefault();
                    return;
                }
                lastWasSymbol = true
            } else if (!USERNAME_ALLOWED.includes(v[i])) {
                fieldUsername.setCustomValidity("Username must be alphanumeric plus \"-_.\".");
                ev.preventDefault();
                return;
            } else if (lastWasSymbol)
                lastWasSymbol = false;
        }
        if (lastWasSymbol) {
            fieldUsername.setCustomValidity("Username cannot end with a symbol.");
            ev.preventDefault();
        }
    });
});