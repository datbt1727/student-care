# Mốc phát hành được người dùng xác nhận — 24/10/2026

- Phiên bản đang sử dụng: v5.1 (theo xác nhận trực tiếp của người dùng).
- Mốc đóng gói kế tiếp phải dựa trên v5 + bản sửa v5.1 bỏ Lưu vào Tệp / Chia sẻ.
- Chưa áp dụng công cụ xuất QA/tổng hợp từ bản sao B2 khi website bị sự cố.
- Chưa áp dụng gói báo cáo mã hóa .screports, REPORT_PASSWORD, công cụ mở gói hoặc quy trình Codespaces Secrets bổ sung cho tính năng này.
- Không tự đưa các bản nháp trên vào bản cập nhật kế tiếp, không thêm dependencies, UI, API, test hoặc yêu cầu cấu hình của chúng. Chỉ xem xét lại khi người dùng yêu cầu bổ sung.
- Các bản nháp đã được tách khỏi mã phát hành và giữ ở work/Student-Care-Du-thao-chua-ap-dung để tham khảo, không phải nguồn đóng gói.
- Giữ nguyên mã hóa, xác nhận lưu, sao lưu B2 và các tính năng đã có trong v5/v5.1. Không hiểu việc tạm hoãn công cụ mới là yêu cầu tắt sao lưu hay giảm bảo mật hiện tại.
- Các ZIP/guide công cụ báo cáo khẩn cấp đã tạo trước đó chỉ là bản nháp chưa được người dùng áp dụng; không gộp vào ZIP kế tiếp.

- Đã chuẩn bị gói logo SC mẫu 01 v5.2 trên nền v5.1; chưa xác nhận người dùng triển khai. Chỉ thay giao diện thương hiệu và favicon, không kèm tính năng đang tạm hoãn.
- Đã chuẩn bị v5.2.1 sửa bố cục điện thoại và ẩn tiêu đề đăng nhập dưới logo; chưa xác nhận triển khai.
- Đã chuẩn bị v5.2.2 bỏ nút hướng dẫn trong menu Tài khoản; ảnh người dùng cho thấy bố cục/logo v5.2.1 đang hiển thị trên điện thoại.
- Đã chuẩn bị v5.2.3 tăng khoảng cách logo với biểu mẫu đăng nhập và bỏ giới hạn chiều cao logo cũ.
- Đã chuẩn bị v5.3: sync revision 15 giây, giữ học kỳ/ngày xem, bảo vệ draft/file/editor và giao dịch đang lưu. Chưa tự gộp xung đột; chưa xác nhận triển khai. 41 kiểm thử + DOM đạt.
- 25/10/2026: chuẩn bị v5.4 bỏ 4 cột khỏi mẫu và parser danh sách học kỳ; bổ sung kiểm tra và khóa xác nhận nếu file/kỳ thay đổi. Giữ dữ liệu lịch sử. Build + 7 package tests + DOM/XLSX đạt; chưa xác nhận triển khai.
- 26/10/2026: chuẩn bị v5.4.1 bỏ 4 trường khỏi hồ sơ, editor và lịch sử hiển thị; không xóa dữ liệu kho. Build/package/DOM đạt, chưa xác nhận triển khai.
- 26/10/2026: chuẩn bị v5.4.2 phân loại lỗi kết nối/timeout/HTTP/payload, retry có giới hạn chỉ đọc và lưu idempotent, giữ kiểm tra receipt. 21 tests + DOM đạt; chưa xác định root cause production hoặc triển khai.
- 26/10/2026: chuẩn bị v5.5: bỏ save khi đổi view; gộp ba phiên bản cho thay đổi độc lập, hộp lựa chọn xung đột, giữ CAS/receipt/quyền; làm mới dữ liệu trước xuất. 54 test hệ thống + DOM đạt; trường hợp lịch sử/học kỳ bị xóa dừng giữ draft. Chưa xác nhận triển khai.
- Chuẩn bị v5.5.1 thêm lọc mức cảnh báo tại Cần xử lý, chỉ thay view; build/package/DOM đạt; chưa xác nhận triển khai.

- 27/10/2026: chuẩn bị v5.6: lọc môn kết hợp mức cảnh báo, ghi chú nội bộ nhanh có kiểm tra quyền/receipt và giữ draft; bỏ 4 trường khỏi QA/tổng hợp kỳ và bảo vệ mọi XLSX qua export schema guard. Build, 58 kiểm thử hệ thống và DOM/XLSX thực tế đạt. Không migration/env/dependencies; giữ dữ liệu kho lịch sử và không thêm tính năng báo cáo ngoại tuyến đang hoãn. Chưa triển khai production.

- Chuẩn bị v5.6.1 lọc danh sách thay đổi gửi email theo tỷ lệ mới 10%–25% bao gồm hai mốc, trước làm tròn. Build/11 package-schema/DOM đạt; chưa triển khai.

- Chuẩn bị v5.6.2 thêm lưu đồng loạt ghi chú nhanh bằng một persist, giữ bản nháp ẩn và xác nhận từng mục; giữ v5.6.1 lọc email 10%–25%. Build, 58 tests và DOM/XLSX đạt; chưa triển khai.

- 28/10: v5.6.3 sửa RangeError tái hiện khi regex Base64 xử lý cipher lớn; kiểm tra tuần tự và canonical Base64, giữ AES GCM. 60 tests + DOM/build đạt. Chưa xác nhận production; không đổi env/schema/key.

- 28/10: v5.6.4 nén gzip gói save lớn, giải nén sau auth/CSRF/quyền với giới hạn 24MB; giữ hash JSON gốc/CAS/idempotency. Build/63 tests/DOM đạt, chưa triển khai. Giữ tab cũ và bản chưa đồng bộ trước cập nhật.

- 28/10: v5.7 chọn dòng, điền ghi chú chung, hoàn tất từng/hàng loạt có receipt, lọc tỷ lệ đang có và đổi Xem hồ sơ. Giữ dòng khi save lỗi, giữ missing-data. Build/63 tests/DOM đạt; chưa triển khai. Không schema/env/dependencies.

- 28/10: v5.7.1 gọn nhóm bộ lọc/thao tác/bảng, checkbox cạnh sinh viên, nút dòng ngang; tỷ lệ phụ thuộc mức/môn và reset giá trị không hợp lệ. Build/package7/DOM đạt; chưa kiểm tra trình duyệt thật hoặc triển khai.

- 28/10: v5.7.2 loại checkbox/label khỏi mở hồ sơ, queue theo thay đổi tỷ lệ từ lần resolved, lưu snapshot tỷ lệ khi hoàn tất, môn theo severity. Build/68tests/DOM đạt; chưa triển khai. Giữ mã hóa/backup và không thêm offline reports.

- 30/10: v5.7.3 QA/tổng hợp tách khối môn/nhóm khi nhiều nhóm cùng ngày, ghi chú đúng nhóm; báo lỗi/progress cạnh nút, khóa doubleclick. Build/68tests/DOM-XLSX đạt. Chưa triển khai hoặc thử dữ liệu production. Không xóa/gộp nhóm nguồn.

- 30/10: v5.7.4 QA/tổng hợp thêm Follow ghi chú chung, chỉ nội dung không ngày giờ; giữ ghi chú cho SV không điểm danh, lọc đến asof. Build/package11/DOM-XLSX đạt. Chưa triển khai.

- 30/10: v5.8 áp dụng demo: tab current/backfill, ngày Follow riêng và lọc severity/course/rate; bulk save scope ngày/kỳ, giữ draft và trạng thái khác ngày. Build/68tests/DOM-XLSX đạt, chưa triển khai. Không schema/env/dependencies/offline reports.

- 30/10: v5.8.1 bố cục gọn hai tab, toolbar chọn/ghi chung/resolve/save, common editor gập mặc định giữ text. Build/package7/DOM-XLSX đạt; chưa browser/production. Không thay schema/env/quyền hoặc thêm offline reports.

- 30/10: chuẩn bị v5.8.2 gọn bảng/checkbox, cột thao tác bảo lưu-thôi học, nhập file, tab con lịch sử; xem trước QA/tổng hợp và PDF cá nhân trực tiếp A4. Build/package7/DOM-XLSX đạt; PDF Chrome giả lập ba trang đã render kiểm tra. Chưa production/iPhone. Không schema/env/dependencies/offline reports.

- 30/10: chuẩn bị v5.8.3 thiết kế lại preview đúng ô gộp/thead/sticky/phân trang 30 dòng và PDF có SC/logo/thống kê/bảng cảnh báo/tiêu đề lặp. Build/package7/DOM-XLSX đạt; Chrome giả lập 65 SV, desktop390px/1440px và PDF20môn 2trang đã kiểm tra ảnh. Chưa production/Safari thật; không schema/env/dependencies/offline reports.

- 31/10: chuẩn bị v5.9 tối ưu DB egress bằng CASE sync, admin save metadata-only, stale save dừng sớm, giữ authorizeArchive nhân viên; poll thích nghi/health tab hiện; JSON400; mã public content-hash immutable, API/HTML no-store. 72 tests + DOM/XLSX đạt; sau JSON400 chạy lại14 tests liên quan đạt. Mẫu20sync 32.147.680B xuống600B cho kết quả archive, không phải tổng traffic Neon. Không schema/env/khóa/định dạng cipher/offline reports; chưa production.

- 31/10: chuẩn bị v5.10 tab Đã xử lý/bộ lọc, lưu note current kèm hoàn tất sau receipt, hoàn tất hồ sơ thiếu dữ liệu không tạo điểm danh; email đối chiếu ngày gần nhất cùng SV/môn/nhóm, phản hồi kiểm tra rõ ràng. Build38/78tests/DOM-XLSX đạt, chưa production. Giữ v5.9; không schema/env/dependencies/offline reports.

- 09/11/2026: chuẩn bị v5.11 chọn Part khi nhập, lọc Part, gán FALL 2026 cũ vào Part 1 theo xác nhận trực tiếp của người dùng. Môn/nhóm Cả kỳ được đánh dấu trên UI và nhớ trong lần nhập sau; tiếp tục tỷ lệ qua 2 Part, chỉ học lại nhóm mới mới tính riêng. Phân cả lịch sử file, giữ audit/notes; API kiểm tra phạm vi nhóm. Build40/88tests/DOM-XLSX đạt; chưa production/Safari thật. Không SQL/schema/env/dependencies/offline reports. Giữ v5.9 tối ưu băng thông.

- 10/11/2026: v5.12 partial attendance preflight/roster/Part exclusion, catalog full-term presets, <10MB XLSX, course filter/paging/cache/index, birthday G exclusion, 2-decimal percentages and dated Follow. Build44/98tests/DOM-XLSX/static public checks/dependency audit passed. Storage encryption unchanged; E2EE design only. No production deployment or runtime-secret verification; no deferred offline reports.

- 14/11/2026: v5.13 rounds Excel stored percentage cells at serialization only; removes superseded attendance handler/generated JS; bounded KDF queue, throttled session touch, broken rollback connection disposal, reduced-motion-aware page transition. Build45/102 tests/DOM-XLSX/audit0/public scan passed; post-build 11 targeted passed. No data deletion/schema/key changes or deployment. No production load-test claim.

- 14/11/2026: v5.14 compact term/Part/full-course toolbar, wrapping header and tabs, inline StudentCare copyright; Build46/DOM-XLSX/package-security10 passed. No data/schema/key changes or deployment.

- 18/11/2026: isolated Business Staging Candidate1 only: approved roster report scope, GPDP101 Follow exclusion, unknown master guard, source correction preview, AEG class independence, unknown Tutor rejection, read-only review panel, Codespaces-only runner and encrypted preservation checkpoint. Build48/132tests/DOM-XLSX/publicscan passed. No SQL/data migration/deployment. Full attempt/calendar/detail UI integration still pending.

- 20/11/2026: Study Attempts v2 chỉ staging: xác nhận từng trường hợp, CAS/receipt/audit/checkpoint cipher; import/Part/Follow/QA theo attemptId; giữ raw lịch sử, không SQL migration/Production/autoemail/offline reports. 164 Node tests và DOM/XLSX đạt; cần kiểm thử thực tế staging.

- 20/11/2026: Business RC1 bổ sung đường Production có bật rõ ràng; checkpoint S3 mã hóa/tải lại xác minh bằng cấu hình backup sẵn có trước ghi, không dùng local filesystem trên Vercel. Không triển khai hoặc tự chuyển dữ liệu staging sang Production.
