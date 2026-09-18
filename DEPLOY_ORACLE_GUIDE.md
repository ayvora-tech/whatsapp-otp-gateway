# Complete Guide: Deploying to Oracle Cloud "Always Free" VM ($0 Forever)

Follow this step-by-step guide to run your WhatsApp OTP Gateway 24/7 in the cloud. Once set up, **you can turn off your computer**, and your WhatsApp service will keep sending OTPs continuously for free.

---

## Step 1: Create Your Free VM on Oracle Cloud

1. Go to **[Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)** and sign up (or sign in).
2. In the Oracle Cloud Console, navigate to **Compute** &rarr; **Instances** &rarr; **Create Instance**.
3. **Configure your instance**:
   * **Name**: `whatsapp-otp-gateway`
   * **Image**: Select **Ubuntu 22.04** or **Ubuntu 24.04** (Recommended).
   * **Shape**:
     * Either **VM.Standard.E2.1.Micro** (AMD, 1 OCPU, 1 GB RAM - Always Free Eligible)
     * Or **VM.Standard.A1.Flex** (Ampere ARM, up to 4 OCPUs, 24 GB RAM - Always Free Eligible)
   * **SSH Keys**: Download both the **Private Key** and **Public Key** to your computer.
4. Click **Create** and wait 1–2 minutes for the instance status to turn **Running**.
5. Copy your **Public IP Address** (e.g. `129.151.xx.xx`).

---

## Step 2: Open Port 3000 in Oracle Cloud Firewall

By default, Oracle Cloud blocks incoming web traffic. You must allow port 3000:

1. On your instance details page, click on your **Virtual Cloud Network (VCN)**.
2. Under Resources on the left, click **Security Lists** &rarr; click **Default Security List for...**.
3. Click **Add Ingress Rules**:
   * **Source CIDR**: `0.0.0.0/0`
   * **IP Protocol**: `TCP`
   * **Destination Port Range**: `3000`
   * **Description**: `WhatsApp OTP Gateway Dashboard & API`
4. Click **Add Ingress Rules**.

---

## Step 3: Connect to Your VM & Configure Ubuntu Firewall

1. Open your terminal on your computer and SSH into the VM:
   ```bash
   ssh -i /path/to/your-private-key.key ubuntu@YOUR_VM_PUBLIC_IP
   ```

2. Once logged in, allow port 3000 through the Ubuntu internal firewall:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
   sudo netfilter-persistent save
   ```
   *(Or if using ufw: `sudo ufw allow 3000/tcp`)*

---

## Step 4: Install Node.js & PM2 (Process Manager)

Run these commands inside your VM terminal:

```bash
# 1. Update packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Verify installation
node -v && npm -v

# 4. Install PM2 globally (keeps the app running 24/7)
sudo npm install -g pm2
```

---

## Step 5: Upload or Clone Your Project

You can either push your project to a private GitHub repository and `git clone` it:

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-otp-gateway.git
cd whatsapp-otp-gateway
npm install
```

Or upload the project folder directly from your computer using `rsync` or `scp`:
```bash
# Run this from your local computer:
rsync -avz -e "ssh -i /path/to/key.key" \
  --exclude 'node_modules' --exclude 'data/auth_info' \
  "/Users/rogerpeter/whatsapp otp project/" \
  ubuntu@YOUR_VM_PUBLIC_IP:~/whatsapp-otp-gateway/
```

Then inside the VM:
```bash
cd ~/whatsapp-otp-gateway
npm install
```

---

## Step 6: Start with PM2 (24/7 Auto-Restart)

Start the service so that it automatically runs in the background and restarts if the VM ever reboots:

```bash
# Start the app
pm2 start ecosystem.config.cjs

# Save the process list
pm2 save

# Enable PM2 to launch on system boot
pm2 startup
# (Copy and run the command that PM2 prints on your screen)
```

To view logs anytime inside the VM:
```bash
pm2 logs whatsapp-otp-gateway
```

---

## Step 7: Link Your WhatsApp (Scan Once)

1. Open your web browser and go to:
   ```
   http://YOUR_VM_PUBLIC_IP:3000
   ```
2. You will see the **WhatsApp OTP Gateway Dashboard** with a live QR code.
3. Open **WhatsApp** on your mobile phone:
   * **Android**: Tap the 3 dots &rarr; **Linked Devices** &rarr; **Link a Device**.
   * **iPhone**: Tap **Settings** &rarr; **Linked Devices** &rarr; **Link a Device**.
4. Scan the QR code on your screen.
5. Within 2 seconds, the dashboard turns **Green (Connected)** with your phone number displayed!

---

## Step 8: You're Done!

You can now:
* **Turn off your computer** & turn off your home Wi-Fi.
* The VM in Oracle Cloud stays running **24/7/365 at $0 cost**.
* Your mobile app or backend can call `POST http://YOUR_VM_PUBLIC_IP:3000/api/otp/send` with your `x-api-key` header to dispatch instant WhatsApp OTP messages anytime!
