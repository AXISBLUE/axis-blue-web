const state = {
  merchandiser: null,
  date: null,
  store: null
};

function beginRoute() {
  state.merchandiser = document.getElementById('merchandiser').value;
  state.date = document.getElementById('date').value;

  localStorage.setItem('axis_state', JSON.stringify(state));
  alert('Route started for ' + state.merchandiser);
}

function startVisit() {
  state.store = document.getElementById('store').value;
  localStorage.setItem('axis_state', JSON.stringify(state));
  alert('Visit started: ' + state.store);
}

function generateEVS() {
  alert('EVS generation placeholder');
}

function generatePDR() {
  alert('PDR generation placeholder');
}
