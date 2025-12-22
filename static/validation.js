// Display error messages in the UI
function showErrors(errors, elementId) {
  const errorContainer = document.getElementById(elementId);
  errorContainer.innerHTML = errors.map(error => `<p class="error">${error}</p>`).join("");
}

// Signup form validation logic
function getSignupFormErrors(firstname, email, password, repeatPassword) {
  let errors = [];

  if (!firstname) {
    errors.push("Firstname is required");
  }

  if (!email) {
    errors.push("Email is required");
  }

  if (!password) {
    errors.push("Password is required");
  }

  if (password.length < 8) {
    errors.push("Password must have at least 8 characters");
  }

  if (password !== repeatPassword) {
    errors.push("Passwords do not match");
  }

  return errors;
}

// Login form validation logic
function getLoginFormErrors(email, password) {
  let errors = [];

  if (!email) {
    errors.push("Email is required");
  }

  if (!password) {
    errors.push("Password is required");
  }

  return errors;
}

// Signup handler (MongoDB via Flask API)
async function handleSignup(email, password, firstname, repeatPassword) {
  const errors = getSignupFormErrors(firstname, email, password, repeatPassword);
  if (errors.length > 0) {
    showErrors(errors, "signup-errors");
    return;
  }

  try {
    const response = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstname, email, password }),
    });

    const result = await response.json();

    if (response.ok) {
      alert("Signup successful! Redirecting to login...");
      window.location.href = "/";
    } else {
      showErrors([result.message], "signup-errors");
    }
  } catch (error) {
    console.error("Signup Error:", error);
    showErrors(["Signup failed. Please try again."], "signup-errors");
  }
}



// Logout handler
async function handleLogout() {
  try {
    await fetch("/logout", { method: "POST" });
    localStorage.removeItem("user");
    window.location.href = "/";
  } catch (error) {
    console.error("Logout Error:", error);
  }
}

// Check if user is logged in
function checkLoginStatus() {
  const user = localStorage.getItem("user");
  if (user) {
    document.getElementById("welcome-message").innerText = `Welcome, ${user}!`;
    document.getElementById("logout-button").style.display = "block";
  }
}

// Run on page load
window.onload = checkLoginStatus;
