window.doGoogleLogin = async () => window.Network.loginGoogle();

window.doLogin = async () => {
  const r = await window.Network.login(
    document.getElementById("login-email").value,
    document.getElementById("login-pass").value,
  );
  if (!r.success) alert(r.error);
};

window.doRegister = async () => {
  const r = await window.Network.register(
    document.getElementById("reg-email").value,
    document.getElementById("reg-pass").value,
  );
  if (r.success) alert("Registered! You can login now.");
  else alert(r.error);
};

window.toggleAuth = (mode) => {
  if (mode === "register") {
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("register-form").classList.remove("hidden");
  } else {
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
  }
};

window.doLogout = () => {
  window.Network.logout();
  location.reload();
};
