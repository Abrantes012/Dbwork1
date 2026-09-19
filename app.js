const SESSION_KEY = "dbwork_session_v2";

let residents = [];
let arrivals = [];
let rooms = [];
let remoteUsers = [];

let currentUser = null;


/* =========================================================
   GOOGLE SHEETS API
========================================================= */

async function apiGet() {

  const response = await fetch(
    CONFIG.API_URL + "?action=getAll"
  );

  if (!response.ok) {
    throw new Error("Could not connect to Google Sheets.");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Google Sheets error.");
  }

  return result.data;
}


async function apiPost(payload) {

  const response = await fetch(
    CONFIG.API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    throw new Error("Could not save data.");
  }

  return await response.json();
}


/* =========================================================
   LOAD DATABASE
========================================================= */

async function loadDatabase() {

  try {

    const data = await apiGet();

    residents = data.residents || [];
    rooms = data.rooms || [];
    arrivals = data.arrivals || [];
    remoteUsers = data.users || [];

    return true;

  } catch (error) {

    console.error(error);

    alert(
      "Could not connect to the database.\n\n" +
      "Please check the Google Apps Script URL."
    );

    return false;
  }
}


/* =========================================================
   SAVE DATABASE
========================================================= */

async function saveAll() {

  try {

    const result = await apiPost({
      action: "saveAll",

      data: {
        residents,
        rooms,
        arrivals,
        users: remoteUsers
      }
    });

    if (!result.success) {
      throw new Error(
        result.error || "Save failed."
      );
    }

    return true;

  } catch (error) {

    console.error(error);

    alert(
      "The information could not be saved to Google Sheets."
    );

    return false;
  }
}


/* =========================================================
   USERS
========================================================= */

function users() {

  return remoteUsers;
}


function me() {

  if (!currentUser) {

    const username =
      localStorage.getItem(SESSION_KEY);

    if (username) {
      currentUser =
        users().find(
          u => u.username === username
        );
    }
  }

  return currentUser;
}


function roleText(role) {

  if (role === "admin") {
    return "Administrator";
  }

  if (role === "editor") {
    return "Editor";
  }

  return "Viewer";
}


function editable() {

  return me()?.role !== "viewer";
}


function admin() {

  return me()?.role === "admin";
}


/* =========================================================
   ROOMS
========================================================= */

function room(number) {

  const residentsInRoom =
    residents.filter(
      resident =>
        Number(resident.room) === Number(number)
    );

  const roomInfo =
    rooms.find(
      item =>
        Number(item.number) === Number(number)
    );

  const capacity =
    Number(roomInfo?.capacity || 2);

  let type;

  if (residentsInRoom.length >= capacity) {
    type = "full";
  } else if (residentsInRoom.length > 0) {
    type = "partial";
  } else {
    type = "available";
  }

  return {
    n: Number(number),
    rs: residentsInRoom,
    cap: capacity,
    type,

    label:
      type === "full"
        ? "Full"
        : type === "partial"
        ? "Partially Occupied"
        : "Available"
  };
}


/* =========================================================
   NAVIGATION
========================================================= */

function go(page) {

  if (
    page === "users" &&
    !admin()
  ) {
    alert(
      "Administrator permission required."
    );

    return;
  }

  document
    .querySelectorAll(".page")
    .forEach(
      pageElement =>
        pageElement.classList.remove("active")
    );

  document
    .getElementById(page)
    ?.classList.add("active");

  document
    .querySelectorAll(".nav")
    .forEach(
      button =>
        button.classList.toggle(
          "active",
          button.dataset.page === page
        )
    );

  if (page === "rooms") {
    renderRooms();
  }

  if (page === "residents") {
    renderResidents();
  }

  if (page === "arrivals") {
    renderArrivals();
  }

  if (page === "users") {
    renderUsers();
  }
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  document
    .getElementById("date")
    .textContent =
      new Date().toLocaleDateString(
        "en-GB",
        {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric"
        }
      );


  document
    .querySelectorAll(".nav")
    .forEach(
      button =>
        button.onclick =
          () => go(button.dataset.page)
    );


  document
    .querySelectorAll("[data-page-jump]")
    .forEach(
      button =>
        button.onclick =
          () => go(button.dataset.pageJump)
    );


  document
    .querySelectorAll("[data-op]")
    .forEach(
      button =>
        button.onclick =
          () => operation(button.dataset.op)
    );


  document
    .getElementById("roomSearch")
    .oninput =
      renderRooms;


  document
    .getElementById("roomFilter")
    .onchange =
      renderRooms;


  document
    .getElementById("residentSearch")
    .oninput =
      renderResidents;


  document
    .getElementById("logout")
    .onclick = () => {

      localStorage.removeItem(
        SESSION_KEY
      );

      location.reload();
    };


  document
    .getElementById("saveArrival")
    .onclick =
      saveArrival;


  document
    .getElementById("addUser")
    .onclick =
      addUser;


  document
    .getElementById("addRoom")
    .onclick =
      addRoom;


  document
    .getElementById("modalClose")
    .onclick =
      closeModal;


  document
    .getElementById("modalCancel")
    .onclick =
      closeModal;


  const loaded =
    await loadDatabase();


  if (!loaded) {
    return;
  }


  const savedUsername =
    localStorage.getItem(
      SESSION_KEY
    );


  if (savedUsername) {

    currentUser =
      users().find(
        user =>
          user.username === savedUsername
      );

  }


  if (currentUser) {

    start();

  } else {

    document
      .getElementById("loginBtn")
      .onclick =
        login;
  }
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  const username =
    document
      .getElementById("username")
      .value
      .trim();

  const password =
    document
      .getElementById("password")
      .value;


  try {

    const result =
      await apiPost({
        action: "login",
        username,
        password
      });


    if (
      !result.success ||
      !result.data
    ) {

      const error =
        document.getElementById(
          "loginError"
        );

      error.textContent =
        "Invalid username or password.";

      error.style.display =
        "block";

      return;
    }


    currentUser =
      result.data;


    localStorage.setItem(
      SESSION_KEY,
      currentUser.username
    );


    start();

  } catch (error) {

    console.error(error);

    alert(
      "Could not connect to the login database."
    );
  }
}


/* =========================================================
   START
========================================================= */

function start() {

  document
    .getElementById("login")
    .classList.add("hidden");


  document
    .getElementById("app")
    .classList.remove("hidden");


  const user = me();


  document
    .getElementById("displayName")
    .textContent =
      user.displayName;


  document
    .getElementById("role")
    .textContent =
      roleText(user.role);


  document
    .querySelectorAll(".admin-only")
    .forEach(
      element =>
        element.style.display =
          admin() ? "" : "none"
    );


  document
    .querySelectorAll(".edit-only")
    .forEach(
      element =>
        element.classList.toggle(
          "disabled",
          !editable()
        )
    );


  refresh();
}


/* =========================================================
   REFRESH
========================================================= */

function refresh() {

  renderMetrics();

  renderDashboardRooms();

  renderResidents();

  renderRooms();

  renderArrivals();

  renderUsers();


  const availableRooms =
    rooms.filter(
      item =>
        room(item.number).rs.length <
        room(item.number).cap
    ).length;


  document
    .getElementById(
      "availableForCoord"
    )
    .textContent =
      availableRooms;


  document
    .getElementById(
      "arrivalBadge"
    )
    .textContent =
      arrivals.length;
}


/* =========================================================
   METRICS
========================================================= */

function renderMetrics() {

  const roomData =
    rooms.map(
      item =>
        room(item.number)
    );


  const freeBeds =
    roomData.reduce(
      (total, item) =>
        total +
        item.cap -
        item.rs.length,
      0
    );


  document
    .getElementById("metrics")
    .innerHTML = [

      [
        "Total Rooms",
        roomData.length
      ],

      [
        "Available Rooms",
        roomData.filter(
          x =>
            x.type === "available"
        ).length
      ],

      [
        "Partially Occupied",
        roomData.filter(
          x =>
            x.type === "partial"
        ).length
      ],

      [
        "Full Rooms",
        roomData.filter(
          x =>
            x.type === "full"
        ).length
      ],

      [
        "Total Residents",
        residents.length
      ],

      [
        "Free Beds",
        freeBeds
      ],

      [
        "Upcoming Arrivals",
        arrivals.length
      ]

    ]
      .map(
        item =>
          `<div class="metric">
            <small>${item[0]}</small>
            <strong>${item[1]}</strong>
          </div>`
      )
      .join("");
}


/* =========================================================
   ROOM CARDS
========================================================= */

function card(x) {

  return `
    <div
      class="room ${x.type}"
      onclick="roomDetail(${x.n})"
    >

      <div class="room-top">

        <span class="room-no">
          ${x.n}
        </span>

        <span class="status">
          ${x.label}
        </span>

      </div>

      <div class="bar">
        <div class="fill"></div>
      </div>

      <div class="room-meta">
        ${x.rs.length}/${x.cap} beds ·
        ${
          x.rs.map(
            r => r.name
          ).join(", ") ||
          "No residents"
        }
      </div>

    </div>
  `;
}


function renderDashboardRooms() {

  document
    .getElementById(
      "dashboardRooms"
    )
    .innerHTML =
      rooms
        .map(
          item =>
            room(item.number)
        )
        .map(card)
        .join("");
}


/* =========================================================
   ROOMS
========================================================= */

function renderRooms() {

  const search =
    (
      document
        .getElementById(
          "roomSearch"
        )
        .value ||
      ""
    ).toLowerCase();


  const filter =
    document
      .getElementById(
        "roomFilter"
      )
      .value;


  document
    .getElementById(
      "roomsGrid"
    )
    .innerHTML =
      rooms
        .map(
          item =>
            room(item.number)
        )
        .filter(
          item =>
            (
              !search ||
              String(item.n)
                .includes(search)
            ) &&
            (
              filter === "all" ||
              item.type === filter
            )
        )
        .map(card)
        .join("");


  document
    .getElementById(
      "roomAdmin"
    )
    .innerHTML =
      admin()
        ? rooms
            .map(
              item =>
                `
                <div class="admin-row">

                  <b>
                    Room ${item.number}
                  </b>

                  <span>
                    Capacity ${item.capacity}
                  </span>

                  <button
                    class="btn"
                    onclick="editRoom(${item.number})"
                  >
                    Edit
                  </button>

                  <button
                    class="btn danger"
                    onclick="removeRoom(${item.number})"
                  >
                    Delete
                  </button>

                </div>
                `
            )
            .join("")
        : "";
}


/* =========================================================
   RESIDENTS
========================================================= */

function renderResidents() {

  const search =
    (
      document
        .getElementById(
          "residentSearch"
        )
        .value ||
      ""
    ).toLowerCase();


  const filtered =
    residents.filter(
      resident =>
        [
          resident.name,
          resident.room,
          resident.country,
          resident.company,
          resident.contact,
          resident.phone,
          resident.coordinator
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
    );


  document
    .getElementById(
      "residentRows"
    )
    .innerHTML =
      filtered
        .map(
          resident =>
            `
            <tr>

              <td>
                ${resident.name}
              </td>

              <td>
                ${resident.room}
              </td>

              <td>
                ${resident.country || ""}
              </td>

              <td>
                ${resident.company || ""}
              </td>

              <td>
                ${
                  resident.phone ||
                  resident.contact ||
                  ""
                }
              </td>

              <td>
                ${resident.coordinator || ""}
              </td>

              <td>
                ${resident.arrival || ""}
              </td>

              <td>

                <button
                  class="btn"
                  onclick="editResident(
                    ${residents.indexOf(resident)}
                  )"
                >
                  Edit
                </button>

              </td>

            </tr>
            `
        )
        .join("");
}


/* =========================================================
   ARRIVALS
========================================================= */

function renderArrivals() {

  const element =
    document.getElementById(
      "arrivalsList"
    );


  if (!arrivals.length) {

    element.innerHTML =
      '<div class="note">No pending arrivals.</div>';

    return;
  }


  element.innerHTML =
    arrivals
      .map(
        (arrival, index) =>
          `
          <div class="arrival-card">

            <div>

              <span class="arrival-dot"></span>

              <b>
                ${arrival.name}
              </b>

              <div class="muted">
                ${
                  arrival.date ||
                  "Date not set"
                }
                ·
                ${
                  arrival.country ||
                  "Country not set"
                }
                ·
                ${
                  arrival.phone ||
                  "No phone"
                }
              </div>

              <div class="muted">
                Coordinator:
                ${
                  arrival.coordinator ||
                  "—"
                }

                · Driver:
                ${
                  arrival.driver ||
                  "—"
                }

                ·
                ${
                  arrival.people ||
                  1
                }
                person(s)
              </div>

            </div>

            <div>

              <button
                class="btn"
                onclick="completeArrival(${index})"
              >
                Check In
              </button>

              <button
                class="btn danger"
                onclick="deleteArrival(${index})"
              >
                Remove
              </button>

            </div>

          </div>
          `
      )
      .join("");
}


/* =========================================================
   SAVE ARRIVAL
========================================================= */

async function saveArrival() {

  if (!editable()) {
    return alert(
      "This account is read-only."
    );
  }


  const arrival = {

    name:
      document
        .getElementById(
          "arrName"
        )
        .value
        .trim(),

    phone:
      document
        .getElementById(
          "arrPhone"
        )
        .value
        .trim(),

    coordinator:
      document
        .getElementById(
          "arrCoordinator"
        )
        .value
        .trim(),

    country:
      document
        .getElementById(
          "arrCountry"
        )
        .value
        .trim(),

    date:
      document
        .getElementById(
          "arrDate"
        )
        .value,

    people:
      Number(
        document
          .getElementById(
            "arrPeople"
          )
          .value || 1
      ),

    driver:
      document
        .getElementById(
          "driverName"
        )
        .value
        .trim(),

    vehicle:
      document
        .getElementById(
          "vehicle"
        )
        .value
        .trim(),

    notes:
      document
        .getElementById(
          "arrNotes"
        )
        .value
        .trim()
  };


  if (!arrival.name) {
    return alert(
      "Enter the arrival name."
    );
  }


  arrivals.push(arrival);


  const saved =
    await saveAll();


  if (!saved) {

    arrivals.pop();

    return;
  }


  document
    .getElementById(
      "arrivalSaved"
    )
    .innerHTML =
      `
      <div
        class="note"
        style="margin-top:12px"
      >
        Arrival added.
        A notification is now visible
        in Arrivals.
      </div>
      `;


  [
    "arrName",
    "arrPhone",
    "arrCoordinator",
    "arrCountry",
    "arrDate",
    "driverName",
    "vehicle",
    "arrNotes"
  ]
    .forEach(
      id =>
        document
          .getElementById(id)
          .value = ""
    );


  refresh();
}


/* =========================================================
   ARRIVAL ACTIONS
========================================================= */

function completeArrival(index) {

  if (!editable()) {
    return;
  }

  const arrival =
    arrivals[index];

  operation(
    "checkin",
    arrival
  );
}


async function deleteArrival(index) {

  if (!editable()) {
    return;
  }


  if (
    !confirm(
      "Remove this arrival?"
    )
  ) {
    return;
  }


  const old =
    arrivals[index];


  arrivals.splice(
    index,
    1
  );


  const saved =
    await saveAll();


  if (!saved) {
    arrivals.splice(
      index,
      0,
      old
    );

    return;
  }


  refresh();
}


/* =========================================================
   OPERATIONS
========================================================= */

function operation(
  type,
  preset = null
) {

  if (!editable()) {

    return alert(
      "This account is read-only."
    );
  }


  const title =
    type === "checkin"
      ? "Check In"
      : type === "move"
      ? "Move Room"
      : "Check Out";


  let body = "";


  if (type === "checkin") {

    body = `

      <div class="form two">

        <label>
          Full Name
          <input
            id="opName"
            value="${preset?.name || ""}"
          >
        </label>

        <label>
          Phone
          <input
            id="opPhone"
            value="${preset?.phone || ""}"
          >
        </label>

        <label>
          Country
          <input
            id="opCountry"
            value="${preset?.country || ""}"
          >
        </label>

        <label>
          Coordinator Name
          <input
            id="opCoordinator"
            value="${preset?.coordinator || ""}"
          >
        </label>

        <label>
          Company
          <input id="opCompany">
        </label>

        <label>
          Arrival Date
          <input
            id="opArrival"
            type="date"
            value="${
              preset?.date ||
              new Date()
                .toISOString()
                .slice(0, 10)
            }"
          >
        </label>

        <label>
          Room

          <select id="opRoom">

            ${
              rooms
                .map(
                  item =>
                    room(item.number)
                )
                .map(
                  item =>
                    `
                    <option
                      value="${item.n}"
                      ${
                        item.rs.length >=
                        item.cap
                          ? "disabled"
                          : ""
                      }
                    >
                      ${item.n}
                      —
                      ${item.label}
                    </option>
                    `
                )
                .join("")
            }

          </select>

        </label>

      </div>

    `;

  } else {

    body = `

      <label>
        Resident

        <select id="opResident">

          ${
            residents
              .map(
                resident =>
                  `
                  <option
                    value="${resident.name}"
                  >
                    ${resident.name}
                    —
                    Room ${resident.room}
                  </option>
                  `
              )
              .join("")
          }

        </select>

      </label>

      ${
        type === "move"
          ? `

            <label>

              New Room

              <select id="opRoom">

                ${
                  rooms
                    .map(
                      item =>
                        room(item.number)
                    )
                    .map(
                      item =>
                        `
                        <option
                          value="${item.n}"
                          ${
                            item.rs.length >=
                            item.cap
                              ? "disabled"
                              : ""
                          }
                        >
                          ${item.n}
                          —
                          ${item.label}
                        </option>
                        `
                    )
                    .join("")
                }

              </select>

            </label>

          `
          : ""
      }

    `;
  }


  openModal(
    title,
    body,
    () =>
      saveOperation(
        type,
        preset
      )
  );
}


/* =========================================================
   SAVE OPERATION
========================================================= */

async function saveOperation(
  type,
  preset
) {

  if (
    type === "checkin"
  ) {

    const name =
      document
        .getElementById(
          "opName"
        )
        .value
        .trim();


    const roomNumber =
      Number(
        document
          .getElementById(
            "opRoom"
          )
          .value
      );


    if (!name) {
      return alert(
        "Enter a name."
      );
    }


    if (
      room(roomNumber)
        .rs.length >=
      room(roomNumber)
        .cap
    ) {

      return alert(
        "Room is full."
      );
    }


    residents.push({

      name,

      room: roomNumber,

      country:
        document
          .getElementById(
            "opCountry"
          )
          .value
          .trim(),

      company:
        document
          .getElementById(
            "opCompany"
          )
          .value
          .trim(),

      phone:
        document
          .getElementById(
            "opPhone"
          )
          .value
          .trim(),

      contact:
        document
          .getElementById(
            "opPhone"
          )
          .value
          .trim(),

      coordinator:
        document
          .getElementById(
            "opCoordinator"
          )
          .value
          .trim(),

      arrival:
        document
          .getElementById(
            "opArrival"
          )
          .value
    });


    if (preset) {

      arrivals =
        arrivals.filter(
          item =>
            item !== preset
        );
    }


  } else {

    const name =
      document
        .getElementById(
          "opResident"
        )
        .value;


    const resident =
      residents.find(
        item =>
          item.name === name
      );


    if (type === "move") {

      const newRoom =
        Number(
          document
            .getElementById(
              "opRoom"
            )
            .value
        );


      if (
        room(newRoom)
          .rs.length >=
        room(newRoom)
          .cap
      ) {

        return alert(
          "Room is full."
        );
      }


      if (resident) {
        resident.room =
          newRoom;
      }


    } else {

      residents =
        residents.filter(
          item =>
            item.name !== name
        );
    }
  }


  const saved =
    await saveAll();


  if (!saved) {
    return;
  }


  closeModal();

  refresh();
}


/* =========================================================
   ROOM DETAILS
========================================================= */

function roomDetail(number) {

  const data =
    room(number);


  const buttons =
    admin()
      ? `
        <button
          class="btn"
          onclick="
            editRoom(${number});
            closeModal();
          "
        >
          Edit Room
        </button>
      `
      : "";


  openModal(

    "Room " + number,

    `
      <p>
        <b>Status:</b>
        ${data.label}
      </p>

      <p>
        <b>Occupancy:</b>
        ${data.rs.length}/${data.cap}
      </p>

      <p>
        <b>Residents:</b>
        <br>

        ${
          data.rs
            .map(
              resident =>
                resident.name
            )
            .join("<br>") ||
          "None"
        }

      </p>

      ${buttons}
    `,

    null
  );
}


/* =========================================================
   ADD ROOM
========================================================= */

function addRoom() {

  if (!admin()) {
    return;
  }


  openModal(

    "Add Room",

    `
      <div class="form two">

        <label>
          Room Number
          <input
            id="rn"
            type="number"
          >
        </label>

        <label>
          Capacity
          <input
            id="rc"
            type="number"
            min="1"
            value="2"
          >
        </label>

      </div>
    `,

    async () => {

      const number =
        Number(
          document
            .getElementById("rn")
            .value
        );


      const capacity =
        Number(
          document
            .getElementById("rc")
            .value ||
          2
        );


      if (!number) {
        return alert(
          "Enter a room number."
        );
      }


      if (
        rooms.some(
          item =>
            Number(item.number) ===
            number
        )
      ) {

        return alert(
          "Room already exists."
        );
      }


      rooms.push({
        number,
        capacity
      });


      rooms.sort(
        (a, b) =>
          a.number - b.number
      );


      const saved =
        await saveAll();


      if (!saved) {
        return;
      }


      closeModal();

      refresh();
    }
  );
}


/* =========================================================
   EDIT ROOM
========================================================= */

function editRoom(number) {

  if (!admin()) {
    return;
  }


  const item =
    rooms.find(
      room =>
        Number(room.number) ===
        Number(number)
    );


  openModal(

    "Edit Room",

    `
      <div class="form two">

        <label>
          Room Number

          <input
            id="rn"
            type="number"
            value="${item.number}"
          >

        </label>

        <label>
          Capacity

          <input
            id="rc"
            type="number"
            min="1"
            value="${item.capacity}"
          >

        </label>

      </div>
    `,

    async () => {

      const newNumber =
        Number(
          document
            .getElementById("rn")
            .value
        );


      const newCapacity =
        Number(
          document
            .getElementById("rc")
            .value ||
          2
        );


      if (
        rooms.some(
          room =>
            room !== item &&
            Number(room.number) ===
            newNumber
        )
      ) {

        return alert(
          "Room already exists."
        );
      }


      if (
        residents.some(
          resident =>
            Number(resident.room) ===
            Number(item.number)
        ) &&
        newNumber !==
          Number(item.number)
      ) {

        return alert(
          "Move residents before changing this room number."
        );
      }


      item.number =
        newNumber;

      item.capacity =
        newCapacity;


      rooms.sort(
        (a, b) =>
          a.number - b.number
      );


      const saved =
        await saveAll();


      if (!saved) {
        return;
      }


      closeModal();

      refresh();
    }
  );
}


/* =========================================================
   DELETE ROOM
========================================================= */

async function removeRoom(number) {

  if (!admin()) {
    return;
  }


  if (
    room(number).rs.length
  ) {

    return alert(
      "This room has residents. Move them first."
    );
  }


  if (
    !confirm(
      "Delete room " +
      number +
      "?"
    )
  ) {
    return;
  }


  const oldRooms =
    [...rooms];


  rooms =
    rooms.filter(
      item =>
        Number(item.number) !==
        Number(number)
    );


  const saved =
    await saveAll();


  if (!saved) {
    rooms = oldRooms;
    return;
  }


  refresh();
}


/* =========================================================
   EDIT RESIDENT
========================================================= */

function editResident(index) {

  if (!editable()) {
    return;
  }


  const resident =
    residents[index];


  openModal(

    "Edit Resident",

    `
      <div class="form two">

        <label>
          Full Name

          <input
            id="en"
            value="${resident.name}"
          >
        </label>

        <label>
          Phone

          <input
            id="ep"
            value="${
              resident.phone ||
              resident.contact ||
              ""
            }"
          >
        </label>

        <label>
          Coordinator Name

          <input
            id="ec"
            value="${
              resident.coordinator ||
              ""
            }"
          >
        </label>

        <label>
          Company

          <input
            id="eco"
            value="${
              resident.company ||
              ""
            }"
          >
        </label>

        <label>
          Country

          <input
            id="ect"
            value="${
              resident.country ||
              ""
            }"
          >
        </label>

      </div>
    `,

    async () => {

      resident.name =
        document
          .getElementById(
            "en"
          )
          .value
          .trim();


      resident.phone =
        document
          .getElementById(
            "ep"
          )
          .value
          .trim();


      resident.contact =
        resident.phone;


      resident.coordinator =
        document
          .getElementById(
            "ec"
          )
          .value
          .trim();


      resident.company =
        document
          .getElementById(
            "eco"
          )
          .value
          .trim();


      resident.country =
        document
          .getElementById(
            "ect"
          )
          .value
          .trim();


      const saved =
        await saveAll();


      if (!saved) {
        return;
      }


      closeModal();

      refresh();
    }
  );
}


/* =========================================================
   MODAL
========================================================= */

function openModal(
  title,
  body,
  save
) {

  document
    .getElementById(
      "modalTitle"
    )
    .textContent =
      title;


  document
    .getElementById(
      "modalBody"
    )
    .innerHTML =
      body;


  document
    .getElementById(
      "modal"
    )
    .classList.remove(
      "hidden"
    );


  document
    .getElementById(
      "modalSave"
    )
    .style.display =
      save
        ? "inline-block"
        : "none";


  document
    .getElementById(
      "modalSave"
    )
    .onclick =
      save || null;
}


function closeModal() {

  document
    .getElementById(
      "modal"
    )
    .classList.add(
      "hidden"
    );
}


/* =========================================================
   USERS
========================================================= */

function renderUsers() {

  if (!admin()) {
    return;
  }


  document
    .getElementById(
      "userRows"
    )
    .innerHTML =
      users()
        .map(
          (user, index) =>
            `
            <tr>

              <td>
                ${user.username}
              </td>

              <td>
                ${user.displayName}
              </td>

              <td>
                ${roleText(user.role)}
              </td>

              <td>

                ${
                  user.username === "admin"

                    ? "Protected"

                    : `
                      <button
                        class="btn"
                        onclick="
                          changeRole(${index})
                        "
                      >
                        Change Role
                      </button>

                      <button
                        class="btn danger"
                        onclick="
                          removeUser(${index})
                        "
                      >
                        Delete
                      </button>
                    `
                }

              </td>

            </tr>
            `
        )
        .join("");
}


/* =========================================================
   ADD USER
========================================================= */

function addUser() {

  if (!admin()) {
    return;
  }


  openModal(

    "Add User",

    `
      <div class="form two">

        <label>
          Username
          <input id="nu">
        </label>

        <label>
          Display Name
          <input id="nd">
        </label>

        <label>
          Password
          <input
            id="np"
            type="password"
          >
        </label>

        <label>
          Role

          <select id="nr">

            <option value="editor">
              Editor
            </option>

            <option value="viewer">
              Viewer
            </option>

            <option value="admin">
              Administrator
            </option>

          </select>

        </label>

      </div>
    `,

    async () => {

      const username =
        document
          .getElementById(
            "nu"
          )
          .value
          .trim();


      const displayName =
        document
          .getElementById(
            "nd"
          )
          .value
          .trim();


      const password =
        document
          .getElementById(
            "np"
          )
          .value;


      const role =
        document
          .getElementById(
            "nr"
          )
          .value;


      if (
        !username ||
        !displayName ||
        !password
      ) {

        return alert(
          "Fill all fields."
        );
      }


      if (
        users().some(
          user =>
            user.username ===
            username
        )
      ) {

        return alert(
          "Username already exists."
        );
      }


      remoteUsers.push({

        username,

        displayName,

        password,

        role
      });


      const saved =
        await saveAll();


      if (!saved) {
        return;
      }


      closeModal();

      renderUsers();
    }
  );
}


/* =========================================================
   CHANGE ROLE
========================================================= */

async function changeRole(index) {

  const list =
    users();


  if (
    !admin() ||
    list[index].username ===
      "admin"
  ) {

    return;
  }


  const role =
    prompt(
      "Role: admin, editor or viewer",
      list[index].role
    );


  if (
    ![
      "admin",
      "editor",
      "viewer"
    ].includes(role)
  ) {
    return;
  }


  const oldRole =
    list[index].role;


  list[index].role =
    role;


  const saved =
    await saveAll();


  if (!saved) {

    list[index].role =
      oldRole;

    return;
  }


  renderUsers();
}


/* =========================================================
   DELETE USER
========================================================= */

async function removeUser(index) {

  const list =
    users();


  if (
    !admin() ||
    list[index].username ===
      "admin"
  ) {

    return;
  }


  if (
    !confirm(
      "Delete " +
      list[index].username +
      "?"
    )
  ) {
    return;
  }


  const deleted =
    list.splice(
      index,
      1
    )[0];


  const saved =
    await saveAll();


  if (!saved) {

    list.splice(
      index,
      0,
      deleted
    );

    return;
  }


  renderUsers();
}


/* =========================================================
   START
========================================================= */

init();
