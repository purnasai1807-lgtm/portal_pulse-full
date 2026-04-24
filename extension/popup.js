const fields = ["fullName", "mobile", "email", "age", "idNumber", "username", "password"];

document.addEventListener("DOMContentLoaded", async () => {
  const saved = await chrome.storage.local.get(fields);
  fields.forEach((f) => document.getElementById(f).value = saved[f] || "");
});

document.getElementById("save").addEventListener("click", async () => {
  const data = {};
  fields.forEach((f) => data[f] = document.getElementById(f).value.trim());
  await chrome.storage.local.set(data);
  document.getElementById("msg").innerText = "Details saved";
});

document.getElementById("fill").addEventListener("click", async () => {
  const data = await chrome.storage.local.get(fields);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: autoFillPage,
      args: [data]
    });
    document.getElementById("msg").innerText = "Fill completed";
  } catch (e) {
    document.getElementById("msg").innerText = "Cannot fill this page";
  }
});

function autoFillPage(data) {
  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  function labelText(el) {
    let text = "";

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) text += " " + label.innerText;
    }

    let parent = el.parentElement;

    for (let i = 0; i < 3 && parent; i++) {
      text += " " + parent.innerText;
      parent = parent.parentElement;
    }

    return text.toLowerCase();
  }

  function fieldText(el) {
    return [
      el.name,
      el.id,
      el.placeholder,
      el.type,
      el.getAttribute("aria-label"),
      el.getAttribute("autocomplete"),
      labelText(el)
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function score(el, words) {
    const text = fieldText(el);
    let s = 0;

    words.forEach((w) => {
      if (text.includes(w)) s += 10;
    });

    if (!visible(el)) s -= 100;
    if (el.disabled || el.readOnly) s -= 100;

    return s;
  }

  function best(words) {
    const els = [...document.querySelectorAll("input,textarea,select")];

    return els
      .map((el) => ({ el, s: score(el, words) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)[0]?.el;
  }

  function nativeSet(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");

    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function setValue(el, value) {
    if (!el || !value) return;

    el.focus();

    if (el.tagName === "SELECT") {
      const options = [...el.options];
      const match = options.find((o) =>
        o.text.toLowerCase().includes(String(value).toLowerCase()) ||
        o.value.toLowerCase().includes(String(value).toLowerCase())
      );

      if (match) el.value = match.value;
    } else {
      nativeSet(el, value);
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    el.blur();
  }

  setValue(best(["full name", "fullname", "applicant name", "pilgrim name", "name"]), data.fullName);
  setValue(best(["mobile", "phone", "contact number", "cell", "telephone"]), data.mobile);
  setValue(best(["email", "mail", "e-mail"]), data.email);
  setValue(best(["age", "years"]), data.age);
  setValue(best(["id number", "aadhaar", "aadhar", "passport", "pan", "proof", "identity"]), data.idNumber);
  setValue(best(["username", "user name", "userid", "user id", "login id"]), data.username);
  setValue(best(["password", "passcode", "pass"]), data.password);
}

