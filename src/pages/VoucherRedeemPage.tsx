import { ArrowRight, Ticket } from "lucide-react";
import { VoucherRedeemViewProps } from "../types";

const VoucherRedeemPage = ({ voucherCode, setVoucherCode, handleRedeemVoucher, setView }: VoucherRedeemViewProps) => (
  <div className="px-4 pb-20">
    {/* رأس الصفحة */}
    <div className="flex items-center gap-2 mb-6">
      <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full active:scale-95">
        <ArrowRight size={20} className="text-gray-600" />
      </button>
      <h2 className="text-xl font-bold text-gray-800">استرداد كود الرصيد</h2>
    </div>

    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 px-2">
      <div className="w-20 h-20 bg-brand rounded-lg flex items-center justify-center text-white shadow-xl shadow-brand-soft">
        <Ticket size={40} />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-gray-800">أدخل كود الشحن</h3>
        <p className="text-gray-400 text-sm">أدخل الكود الذي حصلت عليه لشحن رصيدك فوراً</p>
      </div>
      <div className="w-full space-y-3">
        <input
          type="text"
          placeholder="ضع الكود هنا (مثال: GIFT100)"
          value={voucherCode}
          onChange={(e) => setVoucherCode(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-lg px-6 py-4 text-center text-lg font-bold outline-none focus:border-brand shadow-sm"
        />
        <button
          onClick={handleRedeemVoucher}
          disabled={!voucherCode.trim()}
          className="w-full bg-brand text-white py-4 rounded-lg font-bold shadow-lg shadow-brand-soft transition-all active:scale-95 disabled:opacity-50"
        >
          تأكيد الشحن
        </button>
        <button
          onClick={() => setView({ type: "main" })}
          className="w-full text-gray-400 font-bold text-sm py-2"
        >
          إلغاء
        </button>
      </div>
    </div>
  </div>
);

export default VoucherRedeemPage;
