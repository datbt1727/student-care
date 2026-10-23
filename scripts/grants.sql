-- Chạy bằng chủ sở hữu SAU khi tạo role studentcare_app trong Neon.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO studentcare_app;
GRANT SELECT,INSERT,UPDATE ON sc_users,sc_archive,sc_backup_runs TO studentcare_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON sc_sessions,sc_rate,sc_requests TO studentcare_app;
GRANT SELECT,INSERT ON sc_audit TO studentcare_app;
GRANT USAGE,SELECT ON SEQUENCE sc_audit_id_seq TO studentcare_app;
