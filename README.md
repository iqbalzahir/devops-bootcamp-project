# DevOps Bootcamp Final Project

**Nama Calon:** Iqbal  
**Domain Utama:** `keepitshort.my`  
**AWS Region:** `ap-southeast-1` (Singapura)  

---

## 🌐 Senarai URL Projek (Project URLs)

| Perkara | URL | Status | Penerangan |
| :--- | :--- | :---: | :--- |
| **Aplikasi Web** | [http://web.keepitshort.my](http://web.keepitshort.my) | ✅ Aktif | Aplikasi web kontena Docker dijalankan di Web Server (Port 80) melalui Cloudflare DNS |
| **Monitoring (Grafana)** | [https://monitoring.keepitshort.my](https://monitoring.keepitshort.my) | ✅ Aktif | Dashboard pemantauan selamat diakses melalui Cloudflare Tunnel (Private Subnet) |
| **Repositori Awam** | [github.com/iqbalzahir/devops-bootcamp-project](https://github.com/iqbalzahir/devops-bootcamp-project) | ✅ Aktif | Kod sumber lengkap merangkumi App, Terraform, Ansible & CI/CD Workflows |
| **Dokumentasi (GitHub Pages)** | [https://iqbalzahir.github.io/devops-bootcamp-project/](https://iqbalzahir.github.io/devops-bootcamp-project/) | ✅ Aktif | Halaman dokumentasi awam yang diterbitkan secara automatik melalui GitHub Actions |

---

## 🏛️ Senibina Sistem & Rangkaian (System Architecture)

Projek ini membina infrastruktur pelayan selamat dan modular menggunakan **Terraform (IaC)**, **Ansible (Configuration Management)**, **Docker**, **Prometheus & Grafana**, serta **Cloudflare Tunnel**:

```text
                                  ┌─────────────────────────────┐
                                  │      PENGGUNA AWAM /        │
                                  │         INTERNET            │
                                  └──────────────┬──────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   │                                                           │
                   ▼ (HTTP / Port 80)                                          ▼ (HTTPS / Cloudflare Tunnel)
       ┌───────────────────────────────┐                          ┌─────────────────────────────────────┐
       │   http://web.keepitshort.my   │                          │  https://monitoring.keepitshort.my  │
       └───────────────┬───────────────┘                          └──────────────────┬──────────────────┘
                       │                                                             │
                       │ (Public IP: 18.141.46.79)                                   │ (Encrypted Tunnel)
═══════════════════════╪═════════════════════════════════════════════════════════════╪══════════════════════════════
AWS VPC: devops-vpc (10.0.0.0/24)                                                    │
                                                                                     │
 ┌──────────────────────────────────────────────┐                                    │
 │ PUBLIC SUBNET: devops-public-subnet (10.0.0.0/25)                                 │
 │                                              │                                    │
 │  ┌────────────────────────────────────────┐  │                                    │
 │  │ Web Server (10.0.0.5)                  │  │                                    │
 │  │ - Docker Container: shipit-app (:80)   │◄─┘                                    │
 │  │ - Node Exporter (:9100)                │                                       │
 │  └────────────────────▲───────────────────┘                                       │
 └───────────────────────┼───────────────────────────────────────────────────────────┼──────────────────────
                         │                                                           │
 ┌───────────────────────┼───────────────────────────────────────────────────────────┼──────────────────────┐
 │ PRIVATE SUBNET: devops-private-subnet (10.0.0.128/25)                             │                      │
 │                       │                                                           │                      │
 │  ┌────────────────────┴───────────────────┐        ┌──────────────────────────────┴───────────────────┐  │
 │  │ Ansible Controller (10.0.0.135)        │        │ Monitoring Server (10.0.0.136)                    │  │
 │  │ - Ansible 8+ & Git                     │        │ - Prometheus (:9090) (Scrapes 10.0.0.5:9100)     │  │
 │  │ - SSH Private Key: ~/.ssh/id_ed25519   │──SSH──►│ - Grafana Dashboard (:3000)                      │  │
 │  │ - Menguruskan konfigurasi semua node   │        │ - Cloudflared Tunnel Container                   │  │
 │  └────────────────────────────────────────┘        └───────────────────────────────────────────────────┘  │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Struktur Repositori

```text
.
├── .github/
│   └── workflows/
│       ├── deploy.yml            # CI/CD: Auto build, push ECR & deploy via AWS SSM
│       └── pages.yml             # CI/CD: Penerbitan dokumentasi automatik ke GitHub Pages
├── app/                          # Kod Aplikasi Web
│   ├── src/                      # Source code (HTML, CSS, JS / Vite)
│   ├── Dockerfile                # Multi-stage Docker build yang dioptimumkan
│   └── package.json
├── terraform/                    # Modul Infrastructure as Code (IaC)
│   ├── providers.tf              # AWS & Cloudflare providers + S3 Remote Backend
│   ├── network.tf                # VPC, Public Subnet, Private Subnet, IGW & NAT Gateway
│   ├── security.tf               # Security Group ketat (Public & Private)
│   ├── ec2.tf                    # 3 EC2 Instances, SSH Keygen & Cloud-Init User Data
│   ├── ecr.tf                    # AWS ECR Repository
│   ├── dns.tf                    # Automasi Cloudflare DNS Record
│   ├── variables.tf              # Pembolehubah konfigurasi
│   ├── terraform.tfvars          # Nilai pembolehubah Cloudflare & Token
│   └── outputs.tf                # Output IP, SSM session command & URL
├── ansible/                      # Configuration Management
│   ├── ansible.cfg               # Konfigurasi lalai & path inventory
│   ├── inventory.ini             # Senarai host target (web & monitoring)
│   ├── requirements.yml          # Roles & Collections (geerlingguy.docker, prometheus)
│   ├── site.yml                  # Playbook induk
│   ├── playbooks/
│   │   ├── 01-docker.yml         # Pemasangan Docker Engine pada semua pelayan
│   │   ├── 02-deploy-app.yml     # ECR login, image pull & run container di Web Server
│   │   └── 03-monitoring.yml     # Setup Node Exporter, Prometheus, Grafana & Tunnel
│   └── templates/
│       ├── prometheus.yaml.j2    # Konfigurasi scrape target Prometheus
│       └── compose.yaml.j2       # Docker Compose stack untuk Monitoring & Tunnel
└── README.md                     # Dokumentasi penuh projek
```

---

## 🚀 Panduan Pelaksanaan Mengikut Fasa (Step-by-Step Guide)

### Fasa 1: Infrastructure Provisioning (Terraform IaC)
1. **S3 Remote Backend:** Menyimpan *state file* secara selamat dan berpusat di AWS S3 dengan *state locking*.
2. **Rangkaian VPC Modular:** Dibina menggunakan subnet awam dan persendirian, lengkap dengan Internet Gateway dan NAT Gateway untuk keselamatan pelayan persendirian.
3. **Automasi Kunci SSH & User Data:** Terraform menjana pasangan kunci `ED25519`, meletakkan *Public Key* pada semua pelayan dan menyuntik *Private Key* secara automatik ke dalam Ansible Controller semasa boot.

```bash
cd terraform
terraform init
terraform plan
terraform apply -auto-approve
```

---

### Fasa 2: Configuration Management (Ansible & Docker)
1. **Pemasangan Docker:** Menggunakan Ansible Role rasmi `geerlingguy.docker` untuk memasang Docker Engine dan Docker Compose pada semua pelayan.
2. **Docker Multi-stage Build & AWS ECR:** Kod aplikasi web di dalam `app/` dibina menjadi imej Docker ringan dan ditolak ke AWS ECR.
3. **Automasi Deployment (Idempotent):** Ansible log masuk ke ECR, menarik imej terkini, dan melancarkan kontena `shipit-app` pada port 80.

```bash
# Di dalam Ansible Controller:
cd /home/ubuntu/devops-bootcamp-project/ansible
ansible-galaxy install -r requirements.yml
ansible all -m ping
ansible-playbook site.yml
```

---

### Fasa 3: Monitoring & Observability (Prometheus & Grafana)
1. **Node Exporter:** Dipasang sebagai servis pada Web Server (`10.0.0.5:9100`) untuk mengumpul metrik sistem (CPU, Memori, Disk, Rangkaian).
2. **Prometheus:** Dikonfigurasikan untuk menyedut (*scrape*) metrik daripada Web Server setiap 15 saat melalui rangkaian persendirian.
3. **Grafana:** Menggunakan papan pemuka komuniti rasmi **Node Exporter Full (Dashboard ID: `1860`)** untuk visualisasi masa nyata yang menyeluruh.

---

### Fasa 4: Domain & Secure Access (Cloudflare Tunnel)
1. **Aplikasi Web Awam:** `http://web.keepitshort.my` dihalakan terus ke Elastic IP Web Server menggunakan Cloudflare DNS Proxy.
2. **Akses Monitoring Selamat (Zero-Trust):** Monitoring Server berada di **Private Subnet** tanpa sebarang Public IP atau port terbuka ke internet. Sambungan dibuat secara selamat menggunakan **Cloudflare Tunnel (`cloudflared`)** ke `https://monitoring.keepitshort.my`.

---

### Fasa 5: CI/CD & Automasi GitHub Actions
1. **Dokumentasi Automatik (GitHub Pages):** Fail workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) menerbitkan `README.md` ke GitHub Pages secara automatik setiap kali ada perubahan.
2. **Continuous Deployment (CD):** Fail workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) membina imej Docker baru, menolak ke AWS ECR, dan mengemaskini Web Server melalui **AWS Systems Manager (SSM)** tanpa memerlukan port SSH dibuka ke internet.


