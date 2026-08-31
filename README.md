# DevOps Bootcamp Final Project

**Nama Calon:** Iqbal  
**Domain Utama:** `keepitshort.my`  
**AWS Region:** `ap-southeast-1`

---

## 🌐 Tiga URL Wajib

| Perkara | URL | Status |
| :--- | :--- | :---: |
| **Aplikasi Web** | `http://web.keepitshort.my` | ⏳ Dalam Proses |
| **Monitoring (Grafana)** | `https://monitoring.keepitshort.my` | ⏳ Dalam Proses |
| **Repositori Awam** | [github.com/iqbalzahir/devops-bootcamp-project](https://github.com/iqbalzahir/devops-bootcamp-project) | ✅ Aktif |

---

## 🏛️ Senibina Infrastruktur & Rangkaian

Projek ini membina infrastruktur pelayan selamat dan modular menggunakan Terraform, Ansible, Docker, Prometheus & Grafana, serta Cloudflare Tunnel:

- **VPC:** `devops-vpc` (`10.0.0.0/24`)
- **Public Subnet:** `devops-public-subnet` (`10.0.0.0/25`)
  - **Web Server:** `10.0.0.5` + Elastic IP (Port 80 HTTP, Port 9100 dari Monitoring Server, Port 22 VPC)
  - **NAT Gateway:** `devops-ngw`
  - **Internet Gateway:** `devops-igw`
- **Private Subnet:** `devops-private-subnet` (`10.0.0.128/25`)
  - **Ansible Controller:** `10.0.0.135` (Port 22 VPC)
  - **Monitoring Server:** `10.0.0.136` (Prometheus & Grafana via Cloudflare Tunnel)

---

## 📂 Struktur Repositori

```text
.
├── .github/workflows/       # CI/CD Workflows & GitHub Pages deployment
├── app/                     # Kod aplikasi & Multi-stage Dockerfile
├── terraform/               # Modul Infrastructure as Code (IaC)
├── ansible/                 # Playbooks, inventory, templates & roles
└── README.md                # Dokumentasi utama
```

---

## 🚀 Status Pelaksanaan Fasa

- [ ] **Fasa 1:** Infrastructure Provisioning (Terraform IaC)
- [ ] **Fasa 2:** Configuration Management & Deployment (Ansible & Docker)
- [ ] **Fasa 3:** Monitoring & Observability (Prometheus & Grafana)
- [ ] **Fasa 4:** Domain & Secure Access (Cloudflare Tunnel & DNS)
- [ ] **Fasa 5:** CI/CD & GitHub Pages Documentation
