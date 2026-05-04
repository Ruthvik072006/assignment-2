<template>
  <div class="app-shell">
    <section class="hero container py-4 py-lg-5">
      <div class="row g-4 align-items-stretch">
        <div class="col-lg-7">
          <div class="hero-card h-100 p-4 p-lg-5 rounded-4">
            <span class="badge badge-soft mb-3">Vue.js + Axios + MockAPI</span>
            <h1 class="display-5 fw-bold text-white mb-3">
              Employee Management System
            </h1>
            <p class="lead text-white-50 mb-4">
              Manage employee records with a clean responsive UI. Add, edit, view,
              and delete employees through an external MockAPI endpoint.
            </p>
            <div class="row g-3">
              <div class="col-md-4" v-for="stat in stats" :key="stat.label">
                <div class="stat-card p-3 rounded-4 h-100">
                  <div class="text-uppercase text-white-50 small">{{ stat.label }}</div>
                  <div class="fs-2 fw-bold text-white">{{ stat.value }}</div>
                  <div class="text-white-50 small">{{ stat.help }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="panel-card h-100 p-4 p-lg-5 rounded-4">
            <h2 class="h4 fw-bold mb-3">Setup notes</h2>
            <ul class="text-body-secondary mb-0 ps-3">
              <li>Set `VITE_MOCKAPI_URL` to your MockAPI base URL.</li>
              <li>The resource name should be `employees`.</li>
              <li>Fields used: employeeId, name, designation, department, salary.</li>
              <li>Bootstrap handles the responsive layout and table styling.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <main class="container pb-5">
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="card app-card shadow-sm border-0 rounded-4">
            <div class="card-body p-4 p-lg-5">
              <div class="d-flex justify-content-between align-items-start gap-3 mb-4">
                <div>
                  <h2 class="h4 fw-bold mb-1">
                    {{ editingId ? "Update Employee" : "Add Employee" }}
                  </h2>
                  <p class="text-body-secondary mb-0">
                    Use the form to create or update a record.
                  </p>
                </div>
                <button
                  v-if="editingId"
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="resetForm"
                >
                  Cancel
                </button>
              </div>

              <form class="row g-3" @submit.prevent="saveEmployee">
                <div class="col-12">
                  <label class="form-label">Employee ID</label>
                  <input
                    v-model.trim="form.employeeId"
                    class="form-control"
                    type="text"
                    placeholder="EMP-101"
                    required
                  />
                </div>

                <div class="col-12">
                  <label class="form-label">Name</label>
                  <input
                    v-model.trim="form.name"
                    class="form-control"
                    type="text"
                    placeholder="Aarav Sharma"
                    required
                  />
                </div>

                <div class="col-md-6">
                  <label class="form-label">Designation</label>
                  <input
                    v-model.trim="form.designation"
                    class="form-control"
                    type="text"
                    placeholder="Software Engineer"
                    required
                  />
                </div>

                <div class="col-md-6">
                  <label class="form-label">Department</label>
                  <input
                    v-model.trim="form.department"
                    class="form-control"
                    type="text"
                    placeholder="IT"
                    required
                  />
                </div>

                <div class="col-12">
                  <label class="form-label">Salary</label>
                  <input
                    v-model.number="form.salary"
                    class="form-control"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="50000"
                    required
                  />
                </div>

                <div class="col-12 d-flex flex-wrap gap-2 pt-2">
                  <button class="btn btn-primary px-4" type="submit" :disabled="loading">
                    {{ loading ? "Saving..." : editingId ? "Update Employee" : "Add Employee" }}
                  </button>
                  <button class="btn btn-outline-primary px-4" type="button" @click="loadEmployees" :disabled="loading">
                    Refresh
                  </button>
                </div>
              </form>

              <div v-if="message.text" class="alert mt-4 mb-0" :class="message.className">
                {{ message.text }}
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-7">
          <div class="card app-card shadow-sm border-0 rounded-4 h-100">
            <div class="card-body p-4 p-lg-5">
              <div class="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-4">
                <div>
                  <h2 class="h4 fw-bold mb-1">Employee Records</h2>
                  <p class="text-body-secondary mb-0">
                    {{ employees.length }} record(s) loaded from MockAPI.
                  </p>
                </div>
                <span class="badge text-bg-dark px-3 py-2">External API</span>
              </div>

              <div class="table-responsive">
                <table class="table align-middle table-hover">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th class="text-end">Salary</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="loading && !employees.length">
                      <td colspan="6" class="text-center text-body-secondary py-5">
                        Loading employees...
                      </td>
                    </tr>
                    <tr v-else-if="!employees.length">
                      <td colspan="6" class="text-center text-body-secondary py-5">
                        No employees found. Add one using the form.
                      </td>
                    </tr>
                    <tr v-for="employee in employees" :key="employee.id">
                      <td>{{ employee.employeeId }}</td>
                      <td class="fw-semibold">{{ employee.name }}</td>
                      <td>{{ employee.designation }}</td>
                      <td>{{ employee.department }}</td>
                      <td class="text-end">{{ formatCurrency(employee.salary) }}</td>
                      <td class="text-end">
                        <div class="btn-group btn-group-sm">
                          <button class="btn btn-outline-secondary" @click="startEdit(employee)">
                            Edit
                          </button>
                          <button class="btn btn-outline-danger" @click="deleteEmployee(employee)">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import axios from "axios";
import { computed, onMounted, reactive, ref } from "vue";

function resolveEmployeesUrl(rawUrl) {
  const fallback = "https://example.mockapi.io/api/v1/employees";
  const value = String(rawUrl || "").trim();
  if (!value) {
    return fallback;
  }

  const normalized = value.replace(/\/$/, "");
  if (normalized.includes("/:endpoint")) {
    return normalized.replace(/\/:endpoint$/, "/employees");
  }

  if (normalized.endsWith("/employees")) {
    return normalized;
  }

  return `${normalized}/employees`;
}

const api = axios.create({
  baseURL: resolveEmployeesUrl(import.meta.env.VITE_MOCKAPI_URL),
});

const employees = ref([]);
const loading = ref(false);
const editingId = ref(null);
const message = reactive({
  text: "",
  className: "alert-info",
});

const form = reactive({
  employeeId: "",
  name: "",
  designation: "",
  department: "",
  salary: "",
});

const stats = computed(() => [
  {
    label: "Records",
    value: employees.value.length,
    help: "Loaded from MockAPI",
  },
  {
    label: "Status",
    value: editingId.value ? "Editing" : "New",
    help: "Form state",
  },
  {
    label: "API",
    value: "Live",
    help: "Axios requests",
  },
]);

function showMessage(text, className = "alert-info") {
  message.text = text;
  message.className = className;
}

function clearMessage() {
  message.text = "";
  message.className = "alert-info";
}

function resetForm() {
  editingId.value = null;
  form.employeeId = "";
  form.name = "";
  form.designation = "";
  form.department = "";
  form.salary = "";
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function loadEmployees() {
  loading.value = true;
  clearMessage();
  try {
    const { data } = await api.get("/");
    employees.value = Array.isArray(data) ? data : [];
  } catch (error) {
    showMessage(
      error?.response?.data?.message ||
        "Unable to load employees. Check the MockAPI URL in your `.env` file.",
      "alert-danger",
    );
  } finally {
    loading.value = false;
  }
}

async function saveEmployee() {
  loading.value = true;
  clearMessage();
  const payload = {
    employeeId: form.employeeId,
    name: form.name,
    designation: form.designation,
    department: form.department,
    salary: Number(form.salary),
  };

  try {
    if (editingId.value) {
      await api.put(`/${editingId.value}`, payload);
      showMessage("Employee updated successfully.", "alert-success");
    } else {
      await api.post("/", payload);
      showMessage("Employee added successfully.", "alert-success");
    }
    resetForm();
    await loadEmployees();
  } catch (error) {
    showMessage(
      error?.response?.data?.message ||
        "Could not save employee. Make sure the MockAPI resource is available.",
      "alert-danger",
    );
  } finally {
    loading.value = false;
  }
}

function startEdit(employee) {
  editingId.value = employee.id;
  form.employeeId = employee.employeeId ?? "";
  form.name = employee.name ?? "";
  form.designation = employee.designation ?? "";
  form.department = employee.department ?? "";
  form.salary = employee.salary ?? "";
  showMessage(`Editing ${employee.name}.`, "alert-warning");
}

async function deleteEmployee(employee) {
  if (!window.confirm(`Delete ${employee.name}?`)) {
    return;
  }

  loading.value = true;
  clearMessage();
  try {
    await api.delete(`/${employee.id}`);
    showMessage("Employee deleted successfully.", "alert-success");
    if (editingId.value === employee.id) {
      resetForm();
    }
    await loadEmployees();
  } catch (error) {
    showMessage(
      error?.response?.data?.message ||
        "Could not delete employee. Check your MockAPI permissions.",
      "alert-danger",
    );
  } finally {
    loading.value = false;
  }
}

onMounted(loadEmployees);
</script>
