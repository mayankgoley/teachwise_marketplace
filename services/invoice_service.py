from datetime import datetime


def generate_invoice_html(booking, slot, student, tutor, payment=None):
    date_str = slot.date.strftime('%B %d, %Y')
    time_str = f'{slot.start_time.strftime("%I:%M %p")} - {slot.end_time.strftime("%I:%M %p")}'
    price = float(slot.price or 0)

    payment_status = 'Paid'
    payment_method = 'Card (Stripe)'
    paid_on = ''
    if payment:
        payment_status = payment.status.replace('_', ' ').title()
        if payment.completed_at:
            paid_on = payment.completed_at.strftime('%B %d, %Y at %I:%M %p')
    elif price == 0:
        payment_status = 'Free Session'
        payment_method = 'N/A'

    invoice_number = f'TW-{booking.id:06d}'
    issued_date = datetime.utcnow().strftime('%B %d, %Y')

    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt {invoice_number}</title>
<style>
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #333;
         max-width: 700px; margin: 40px auto; padding: 0 20px; }}
  .header {{ display: flex; justify-content: space-between; align-items: center;
             border-bottom: 2px solid #2563EB; padding-bottom: 20px; margin-bottom: 30px; }}
  .logo {{ font-size: 24px; font-weight: 700; color: #2563EB; }}
  .invoice-num {{ text-align: right; color: #666; }}
  .invoice-num h2 {{ margin: 0; color: #333; font-size: 18px; }}
  .section {{ margin-bottom: 25px; }}
  .section h3 {{ font-size: 14px; color: #2563EB; text-transform: uppercase;
                 letter-spacing: 1px; margin-bottom: 8px; }}
  .details-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
  .detail-label {{ color: #888; font-size: 13px; }}
  .detail-value {{ font-size: 14px; font-weight: 500; }}
  table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
  th {{ background: #F3F4F6; text-align: left; padding: 10px 12px; font-size: 13px;
       color: #555; text-transform: uppercase; letter-spacing: 0.5px; }}
  td {{ padding: 12px; border-bottom: 1px solid #E5E7EB; font-size: 14px; }}
  .total-row td {{ font-weight: 700; font-size: 16px; border-top: 2px solid #333;
                   border-bottom: none; }}
  .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 40px;
             padding-top: 20px; border-top: 1px solid #E5E7EB; }}
  .badge {{ display: inline-block; padding: 3px 10px; border-radius: 12px;
            font-size: 12px; font-weight: 600; }}
  .badge-paid {{ background: #D1FAE5; color: #065F46; }}
  .badge-free {{ background: #DBEAFE; color: #1E40AF; }}
  .badge-pending {{ background: #FEF3C7; color: #92400E; }}
  @media print {{
    body {{ margin: 0; }}
    .no-print {{ display: none; }}
  }}
</style>
</head>
<body>
  <div class="no-print" style="text-align:center; margin-bottom:20px;">
    <button onclick="window.print()"
            style="background:#2563EB; color:white; border:none; padding:10px 24px;
                   border-radius:8px; cursor:pointer; font-size:14px; font-weight:600;">
      Print / Save PDF</button>
    <button onclick="window.close()"
            style="background:#E5E7EB; color:#333; border:none; padding:10px 24px;
                   border-radius:8px; cursor:pointer; font-size:14px; margin-left:8px;">
      Close</button>
  </div>

  <div class="header">
    <div class="logo">TeachWise</div>
    <div class="invoice-num">
      <h2>Receipt</h2>
      <p>{invoice_number}</p>
      <p style="font-size:13px;">{issued_date}</p>
    </div>
  </div>

  <div class="section">
    <h3>Session Details</h3>
    <div class="details-grid">
      <div><span class="detail-label">Date</span><br>
           <span class="detail-value">{date_str}</span></div>
      <div><span class="detail-label">Time</span><br>
           <span class="detail-value">{time_str}</span></div>
      <div><span class="detail-label">Subject</span><br>
           <span class="detail-value">{slot.subject or "General"}</span></div>
      <div><span class="detail-label">Mode</span><br>
           <span class="detail-value">{slot.mode.title()}</span></div>
    </div>
  </div>

  <div class="section">
    <h3>Parties</h3>
    <div class="details-grid">
      <div><span class="detail-label">Student</span><br>
           <span class="detail-value">{student.name}</span><br>
           <span style="color:#888; font-size:12px;">{student.email}</span></div>
      <div><span class="detail-label">Tutor</span><br>
           <span class="detail-value">{tutor.name}</span><br>
           <span style="color:#888; font-size:12px;">{tutor.email}</span></div>
    </div>
  </div>

  <div class="section">
    <h3>Payment Summary</h3>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>{slot.subject or "Tutoring"} Session ({slot.mode.title()})</td>
            <td>${price:.2f}</td></tr>
        <tr class="total-row"><td>Total</td><td>${price:.2f}</td></tr>
      </tbody>
    </table>
    <p style="font-size:13px; color:#666;">
      Status: <span class="badge {"badge-paid" if payment_status in ("Paid","Completed") else "badge-free" if price == 0 else "badge-pending"}">{payment_status}</span>
      &nbsp;&bull;&nbsp; Payment Method: {payment_method}
      {"&nbsp;&bull;&nbsp; Paid: " + paid_on if paid_on else ""}
    </p>
  </div>

  <div class="footer">
    <p>Thank you for using TeachWise!</p>
    <p>Booking #{booking.id} &bull; Generated {issued_date}</p>
  </div>
</body>
</html>'''
    return html
