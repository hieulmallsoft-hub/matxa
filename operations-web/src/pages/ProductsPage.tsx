import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Star, RefreshCw, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TOP_PRODUCTS } from '../data/mockData';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';

export const ProductsPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [isRestocking, setIsRestocking] = useState<string | null>(null);

  const categories = ['Tất cả', 'Trị liệu', 'Thư giãn', 'Bấm huyệt', 'Combo VIP'];

  const handleRestock = (productName: string) => {
    setIsRestocking(productName);
    setTimeout(() => {
      setIsRestocking(null);
      addToast({
        title: 'Đã tạo phiếu nhập kho',
        message: `Đã gửi yêu cầu bổ sung vật tư cho "${productName}" (+50 đơn vị).`,
        type: 'success',
      });
    }, 600);
  };

  const handleAddNewSKU = () => {
    addToast({
      title: 'Thêm vật tư mới',
      message: 'Mẫu đăng ký vật tư & tinh dầu mới đã sẵn sàng.',
      type: 'info',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <PageHeader
        title="Vật tư & Tinh dầu Spa"
        subtitle="Quản lý kho nguyên liệu tự nhiên, tinh dầu trị liệu và dụng cụ massage cấp phát cho kỹ thuật viên"
        breadcrumbs={[
          { label: 'MATXXA', href: '#' },
          { label: 'Quản lý kho & Vật tư' },
        ]}
        actions={
          <button
            onClick={handleAddNewSKU}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-sm font-medium shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm vật tư mới</span>
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng mã vật tư"
          value="48 sản phẩm"
          subValue="Phân bố tại 6 kho trung chuyển"
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Lượt xuất sử dụng"
          value="14.820 lần"
          subValue="Tăng 12.8% so với tháng trước"
          trend={{ value: 12.8, isPositive: true }}
          icon={<Sparkles className="w-5 h-5" />}
        />
        <StatCard
          title="Giá trị tồn kho"
          value="820.000.000 đ"
          subValue="Kiểm kê khớp 99.4%"
          trend={{ value: 4.2, isPositive: true }}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          title="Cảnh báo cần nhập"
          value="2 sản phẩm"
          subValue="Dưới mức an toàn (50 đơn vị)"
          trend={{ value: -1, isPositive: false }}
          icon={<AlertCircle className="w-5 h-5" />}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E5EBE5]">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedCategory === cat
                ? 'bg-[#EAF5EC] text-[#2E7D4A] font-semibold'
                : 'text-[#66756B] hover:text-[#1C2B20] hover:bg-black/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TOP_PRODUCTS.map((prod) => (
          <div
            key={prod.id}
            className="p-5 rounded-2xl bg-white border border-[#E5EBE5] hover:border-[#2E7D4A]/30 hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start"
          >
            <img
              src={prod.image}
              alt={prod.name}
              className="w-full sm:w-32 h-32 rounded-xl object-cover ring-1 ring-[#E5EBE5] flex-shrink-0"
            />

            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#1C2B20] line-clamp-1">{prod.name}</h3>
                  <div className="text-xs text-[#66756B] mt-0.5">{prod.category}</div>
                </div>
                <span className="text-sm font-bold text-[#2E7D4A] whitespace-nowrap">
                  {prod.price.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]">
                <div>
                  <span className="text-[#66756B] block text-[11px]">Tồn kho khả dụng</span>
                  <span className={`font-semibold ${prod.stock < 50 ? 'text-[#F2A93B]' : 'text-[#2E7D4A]'}`}>
                    {prod.stock} đơn vị
                  </span>
                </div>
                <div>
                  <span className="text-[#66756B] block text-[11px]">Doanh số ước tính</span>
                  <span className="text-[#1C2B20] font-semibold">
                    {(prod.revenue / 1000000).toFixed(1)} triệu đ
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#F2A93B] flex items-center gap-1 font-medium">
                  <Star className="w-3.5 h-3.5 fill-current" /> {prod.rating} / 5.0 hài lòng
                </span>

                <button
                  onClick={() => handleRestock(prod.name)}
                  disabled={isRestocking === prod.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF5EC] hover:bg-[#d8edd9] text-[#2E7D4A] text-xs font-medium transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRestocking === prod.name ? 'animate-spin' : ''}`} />
                  <span>{isRestocking === prod.name ? 'Đang gửi...' : 'Nhập kho'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ProductsPage;
