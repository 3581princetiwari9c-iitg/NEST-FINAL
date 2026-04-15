import re

with open('dashboard/admin/requestdashboard.html', 'r') as f:
    content = f.read()

# Replace rows
new_tbody = """        <tbody class="divide-y divide-gray-50">
          <tr class="hover:bg-gray-50 transition-all cursor-pointer group" onclick="openRequestDetail('Aether Dynamics', 'Dr. Alok Nath', 'Startup', '2023', 'Assam')">
            <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px] leading-tight break-words max-w-[240px]">Aether Dynamics</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[13px] uppercase tracking-tight">Startup</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">2023</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">Assam</span></td>
            <td class="px-[24px] py-[20px] text-right" onclick="event.stopPropagation()">
              <div class="flex items-center justify-end gap-[12px]">
                <button class="px-[20px] py-[10px] bg-[#b04a4a] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#8e3b3b] shadow-sm transition-all" onclick="handleReject('Aether Dynamics')">Reject</button>
                <button class="px-[20px] py-[10px] bg-[#1b3a28] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#142c1e] shadow-sm transition-all" onclick="handleApprove('Aether Dynamics')">Approve</button>
              </div>
            </td>
          </tr>
          <tr class="hover:bg-gray-50 transition-all cursor-pointer group" onclick="alert('Program details under optimization.')">
            <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px] leading-tight break-words max-w-[240px]">Green India Initiative</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[13px] uppercase tracking-tight">Program</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">2024</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">Meghalaya</span></td>
            <td class="px-[24px] py-[20px] text-right" onclick="event.stopPropagation()">
              <div class="flex items-center justify-end gap-[12px]">
                <button class="px-[20px] py-[10px] bg-[#b04a4a] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#8e3b3b] shadow-sm transition-all" onclick="handleReject('Green India Initiative')">Reject</button>
                <button class="px-[20px] py-[10px] bg-[#1b3a28] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#142c1e] shadow-sm transition-all" onclick="handleApprove('Green India Initiative')">Approve</button>
              </div>
            </td>
          </tr>
          <tr class="hover:bg-gray-50 transition-all cursor-pointer group" onclick="alert('Newsletter details under optimization.')">
            <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px] leading-tight break-words max-w-[240px]">November Tech Roundup</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[13px] uppercase tracking-tight">Newsletter</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">2024</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">Sikkim</span></td>
            <td class="px-[24px] py-[20px] text-right" onclick="event.stopPropagation()">
              <div class="flex items-center justify-end gap-[12px]">
                <button class="px-[20px] py-[10px] bg-[#b04a4a] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#8e3b3b] shadow-sm transition-all" onclick="handleReject('November Tech Roundup')">Reject</button>
                <button class="px-[20px] py-[10px] bg-[#1b3a28] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#142c1e] shadow-sm transition-all" onclick="handleApprove('November Tech Roundup')">Approve</button>
              </div>
            </td>
          </tr>
          <tr class="hover:bg-gray-50 transition-all cursor-pointer group" onclick="openEntrepreneurDetail('Eco Plast', 'Rahul Sharma', 'Entrepreneur Idea', '2024', 'Manipur')">
            <td class="px-[24px] py-[20px]"><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[16px] leading-tight break-words max-w-[240px]">Eco Plast</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[13px] uppercase tracking-tight">Entrepreneur Idea</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">2024</span></td>
            <td class="px-[24px] py-[20px]"><span class="font-['Inter'] font-normal text-[#464E42] text-[14px]">Manipur</span></td>
            <td class="px-[24px] py-[20px] text-right" onclick="event.stopPropagation()">
              <div class="flex items-center justify-end gap-[12px]">
                <button class="px-[20px] py-[10px] bg-[#b04a4a] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#8e3b3b] shadow-sm transition-all" onclick="handleReject('Eco Plast')">Reject</button>
                <button class="px-[20px] py-[10px] bg-[#1b3a28] text-white font-['Manrope'] font-bold text-[14px] rounded-[10px] hover:bg-[#142c1e] shadow-sm transition-all" onclick="handleApprove('Eco Plast')">Approve</button>
              </div>
            </td>
          </tr>
        </tbody>"""

content = re.sub(r'<tbody class="divide-y divide-gray-50">.*?</tbody>', new_tbody, content, flags=re.DOTALL)

# Add entrepreneur modal 
entrepreneur_modal = """
<!-- Entrepreneur Detail Modal Overlay -->
<div id="entrepreneur-detail-modal" class="fixed inset-0 z-[110] hidden items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm py-[60px]">
  <div class="fixed inset-0 z-0" onclick="closeEntrepreneurDetail()"></div>
  <div class="relative z-10 bg-white rounded-[32px] shadow-[0px_20px_60px_rgba(0,0,0,0.1)] p-[40px] w-full max-w-[1140px] transform transition-all duration-300 scale-95 opacity-0" id="ent-detail-card">
    <button onclick="closeEntrepreneurDetail()" class="absolute top-8 right-8 text-gray-400 hover:text-red-600 transition-all">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div class="flex flex-col gap-[32px]">
      <div class="flex flex-col gap-[8px]">
        <h2 id="ent-detail-title" class="font-['Manrope'] font-bold text-[#1b3a28] text-[28px] leading-tight max-w-[80%] uppercase tracking-tight"></h2>
        <p id="ent-detail-founder" class="font-['Inter'] text-[#677461] text-[16px]"></p>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-[40px]">
        <div class="lg:col-span-2 flex flex-col gap-[32px]">
          <div class="flex flex-col gap-[16px]">
            <h4 class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">Idea Overview</h4>
            <p id="ent-detail-overview" class="font-['Inter'] text-[#464E42] text-[15px] leading-relaxed">
              Detailed description of the entrepreneurial idea goes here.
            </p>
          </div>
          <div class="bg-[#f9f8f4] rounded-[20px] p-[32px] flex flex-col gap-[24px]">
            <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Details</h4>
            <div class="grid grid-cols-2 gap-[24px]">
              <div class="flex flex-col gap-[4px]">
                <span class="font-['Inter'] text-[#677461] text-[12px]">Location</span>
                <span id="ent-detail-location" class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">Assam</span>
              </div>
              <div class="flex flex-col gap-[4px]">
                <span class="font-['Inter'] text-[#677461] text-[12px]">Estimated Budget</span>
                <span id="ent-detail-budget" class="font-['Manrope'] font-bold text-[#1b3a28] text-[18px]">₹10,00,000</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4 mt-4">
            <button class="bg-[#b04a4a] text-white px-10 py-4 rounded-[16px] font-['Manrope'] font-bold text-[16px] shadow-lg hover:bg-[#8e3b3b] transform hover:-translate-y-1 transition-all">Reject Request</button>
            <button class="bg-[#1b3a28] text-white px-10 py-4 rounded-[16px] font-['Manrope'] font-bold text-[16px] shadow-lg hover:bg-[#142c1e] transform hover:-translate-y-1 transition-all">Approve Request</button>
          </div>
        </div>
        <div class="flex flex-col gap-[32px]">
          <div class="flex flex-col gap-[16px]">
            <h4 class="font-['Inter'] font-bold text-[#677461] text-[12px] uppercase tracking-[0.1em]">Documents</h4>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between p-4 bg-[#f3f4f6]/50 rounded-[12px] hover:bg-gray-100 transition-all cursor-pointer">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-red-50 rounded-[8px] flex items-center justify-center border border-red-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[14px]">Pitch_Deck.pdf</span>
                    <span class="font-['Inter'] text-[#677461] text-[11px]">2 MB • Document 1</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between p-4 bg-[#f3f4f6]/50 rounded-[12px] hover:bg-gray-100 transition-all cursor-pointer">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-red-50 rounded-[8px] flex items-center justify-center border border-red-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-['Manrope'] font-bold text-[#1b3a28] text-[14px]">Financials.pdf</span>
                    <span class="font-['Inter'] text-[#677461] text-[11px]">1.2 MB • Document 2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-[#f2faf5] rounded-[20px] p-[24px] flex flex-col gap-[20px]">
            <div class="flex flex-col gap-[4px]"><span class="font-['Inter'] text-[#677461] text-[12px]">Official Email</span><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[15px] whitespace-nowrap">contact@ecoplast.com</span></div>
            <div class="flex flex-col gap-[4px]"><span class="font-['Inter'] text-[#677461] text-[12px]">Phone Number</span><span class="font-['Manrope'] font-bold text-[#1b3a28] text-[15px]">+91 0000112233232</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
"""

content = content.replace('<script>', entrepreneur_modal, 1)

# Add entrepreneur JS logic
js_logic = """
    const entDetailModal = document.getElementById('entrepreneur-detail-modal');
    const entDetailCard = document.getElementById('ent-detail-card');
    const entDetailTitle = document.getElementById('ent-detail-title');
    const entDetailFounder = document.getElementById('ent-detail-founder');
    const entDetailOverview = document.getElementById('ent-detail-overview');
    const entDetailLocation = document.getElementById('ent-detail-location');
    const entDetailBudget = document.getElementById('ent-detail-budget');

    window.openEntrepreneurDetail = function (name, founder, category, year, state) {
      entDetailTitle.textContent = name;
      entDetailFounder.textContent = founder + ' • ' + category;
      entDetailLocation.textContent = state;
      entDetailOverview.textContent = "We are proposing an innovative way to reduce waste through biodegradable materials and community action.";
      entDetailBudget.textContent = "₹ 5,00,000";

      entDetailModal.classList.remove('hidden');
      entDetailModal.classList.add('flex');
      setTimeout(() => {
        entDetailCard.classList.remove('scale-95', 'opacity-0');
        entDetailCard.classList.add('scale-100', 'opacity-100');
      }, 10);
    };

    window.closeEntrepreneurDetail = function () {
      entDetailCard.classList.remove('scale-100', 'opacity-100');
      entDetailCard.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        entDetailModal.classList.add('hidden');
        entDetailModal.classList.remove('flex');
      }, 300);
    };
"""

content = content.replace('window.openRequestDetail = function', js_logic + '\n    window.openRequestDetail = function')

with open('dashboard/admin/requestdashboard.html', 'w') as f:
    f.write(content)
